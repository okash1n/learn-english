//! Desktop sidecarのstdout/stderr専用ローテーション。
//! 学習データには触れず、診断ログだけをsize上限・世代数・redaction付きで保持する。

use std::io::{Read as _, Seek as _, Write as _};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

const DIAGNOSTIC_LOG_MAX_BYTES: u64 = 5 * 1024 * 1024;
const DIAGNOSTIC_LOG_GENERATIONS: usize = 3;
const DIAGNOSTIC_LOG_MAX_LINE_BYTES: usize = 64 * 1024;

fn timestamp() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown-time".to_string())
}

#[derive(Clone, Copy)]
struct LogPolicy {
    max_bytes: u64,
    generations: usize,
    max_line_bytes: usize,
}

impl Default for LogPolicy {
    fn default() -> Self {
        Self {
            max_bytes: DIAGNOSTIC_LOG_MAX_BYTES,
            generations: DIAGNOSTIC_LOG_GENERATIONS,
            max_line_bytes: DIAGNOSTIC_LOG_MAX_LINE_BYTES,
        }
    }
}

fn generation_path(path: &Path, generation: usize) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(format!(".{generation}"));
    PathBuf::from(value)
}

fn sanitize_diagnostic_line(line: &str) -> String {
    let lower = line.to_ascii_lowercase();
    let secret_marker = ["authorization", "bearer ", "api_key", "apikey", "api-key"]
        .iter()
        .any(|marker| lower.contains(marker));
    let raw_key = lower.starts_with("sk-")
        || lower.contains(" sk-")
        || lower.contains("=sk-")
        || lower.contains("\"sk-")
        || lower.starts_with("github_pat_")
        || lower.contains(" github_pat_");
    let sensitive_field = [
        "utterance",
        "transcript",
        "text",
        "body",
        "prompt",
        "messages",
    ]
    .iter()
    .any(|field| {
        lower.starts_with(&format!("{field}="))
            || lower.contains(&format!(" {field}="))
            || lower.contains(&format!("\"{field}\""))
    });
    if secret_marker || raw_key || sensitive_field {
        "[redacted sensitive diagnostic line]".to_string()
    } else {
        line.to_string()
    }
}

fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    const MARKER: &str = "...[truncated]";
    if value.len() <= max_bytes {
        return value.to_string();
    }
    if max_bytes <= MARKER.len() {
        return MARKER[..max_bytes].to_string();
    }
    let mut end = max_bytes - MARKER.len();
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}{}", &value[..end], MARKER)
}

fn trim_file_to_limit(path: &Path, max_bytes: u64) -> std::io::Result<()> {
    let Ok(metadata) = std::fs::metadata(path) else {
        return Ok(());
    };
    if !metadata.is_file() || metadata.len() <= max_bytes {
        return Ok(());
    }
    let size = metadata.len();
    let mut source = std::fs::File::open(path)?;
    source.seek(std::io::SeekFrom::Start(size - max_bytes))?;
    let mut temp_name = path.as_os_str().to_os_string();
    temp_name.push(format!(".trim-{}.tmp", uuid::Uuid::new_v4().simple()));
    let temp = PathBuf::from(temp_name);
    let result = (|| {
        let mut target = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&temp)?;
        std::io::copy(&mut source.take(max_bytes), &mut target)?;
        target.sync_all()?;
        drop(target);
        std::fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(temp);
    }
    result
}

pub(crate) struct RotatingLog {
    path: PathBuf,
    policy: LogPolicy,
    file: Option<std::fs::File>,
    bytes: u64,
}

impl RotatingLog {
    pub(crate) fn open(path: &Path) -> Self {
        Self::open_with_policy(path, LogPolicy::default())
    }

    fn open_with_policy(path: &Path, policy: LogPolicy) -> Self {
        for generation in 0..=policy.generations {
            let candidate = if generation == 0 {
                path.to_path_buf()
            } else {
                generation_path(path, generation)
            };
            let _ = trim_file_to_limit(&candidate, policy.max_bytes);
            if candidate.is_file() {
                let _ =
                    std::fs::set_permissions(&candidate, std::fs::Permissions::from_mode(0o600));
            }
        }
        let mut log = Self {
            path: path.to_path_buf(),
            policy,
            file: None,
            bytes: 0,
        };
        log.reopen();
        log
    }

    fn reopen(&mut self) {
        self.file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .mode(0o600)
            .open(&self.path)
            .ok();
        self.bytes = std::fs::metadata(&self.path).map(|m| m.len()).unwrap_or(0);
    }

    fn rotate(&mut self) -> std::io::Result<()> {
        self.file.take();
        let oldest = generation_path(&self.path, self.policy.generations);
        if oldest.exists() {
            std::fs::remove_file(oldest)?;
        }
        for generation in (1..self.policy.generations).rev() {
            let source = generation_path(&self.path, generation);
            if source.exists() {
                std::fs::rename(source, generation_path(&self.path, generation + 1))?;
            }
        }
        if self.path.exists() {
            std::fs::rename(&self.path, generation_path(&self.path, 1))?;
        }
        self.reopen();
        Ok(())
    }

    pub(crate) fn write_line(&mut self, line: &str) {
        let prefix = format!("{} ", timestamp());
        let available = self.policy.max_line_bytes.min(
            self.policy
                .max_bytes
                .saturating_sub(prefix.len() as u64 + 1) as usize,
        );
        let line = truncate_utf8(&sanitize_diagnostic_line(line), available);
        let entry = format!("{prefix}{line}\n");
        if self.bytes.saturating_add(entry.len() as u64) > self.policy.max_bytes
            && self.rotate().is_err()
        {
            self.reopen();
        }
        if self.file.is_none() {
            self.reopen();
        }
        let Some(file) = self.file.as_mut() else {
            return;
        };
        if file.write_all(entry.as_bytes()).is_ok() && file.flush().is_ok() {
            self.bytes = self.bytes.saturating_add(entry.len() as u64);
        }
    }

    pub(crate) fn is_available(&self) -> bool {
        self.file.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::{sanitize_diagnostic_line, LogPolicy, RotatingLog};
    use std::fs;

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("solo-eikaiwa-{label}-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn keeps_latest_lines_and_bounded_generations() {
        let dir = unique_temp_dir("rotating-log");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sidecar.log");
        fs::write(&path, "legacy-line\n".repeat(100)).unwrap();
        let policy = LogPolicy {
            max_bytes: 96,
            generations: 2,
            max_line_bytes: 64,
        };
        let mut log = RotatingLog::open_with_policy(&path, policy);
        for i in 0..12 {
            log.write_line(&format!("event-{i:02}-{}", "x".repeat(24)));
        }
        drop(log);
        let files = [
            path.clone(),
            path.with_file_name("sidecar.log.1"),
            path.with_file_name("sidecar.log.2"),
        ];
        assert!(files.iter().all(|file| file.exists()));
        let total: u64 = files
            .iter()
            .map(|file| fs::metadata(file).unwrap().len())
            .sum();
        assert!(total <= 96 * 3);
        assert!(fs::read_to_string(&path).unwrap().contains("event-11"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn redacts_secrets_headers_and_utterance_content() {
        assert_eq!(
            sanitize_diagnostic_line("safe diagnostic"),
            "safe diagnostic"
        );
        assert_eq!(
            sanitize_diagnostic_line("task-id=42 context=startup"),
            "task-id=42 context=startup"
        );
        for sensitive in [
            "Authorization: Bearer bearer-secret-value",
            "apiKey=sk-super-secret-value",
            "ANTHROPIC_API_KEY=env-secret-value",
            "utterance=This speech must stay private",
            "text=This transcript must stay private",
        ] {
            assert_eq!(
                sanitize_diagnostic_line(sensitive),
                "[redacted sensitive diagnostic line]"
            );
        }
    }

    #[test]
    fn rotation_failure_does_not_panic_or_stop_following_writes() {
        let dir = unique_temp_dir("rotating-log-failure");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sidecar.log");
        fs::write(&path, "x".repeat(90)).unwrap();
        fs::create_dir(path.with_file_name("sidecar.log.2")).unwrap();
        let policy = LogPolicy {
            max_bytes: 96,
            generations: 2,
            max_line_bytes: 64,
        };
        let mut log = RotatingLog::open_with_policy(&path, policy);
        log.write_line("latest diagnostic after failed rotation");
        assert!(fs::read_to_string(&path)
            .unwrap()
            .contains("latest diagnostic"));
        fs::remove_dir_all(dir).unwrap();
    }
}
