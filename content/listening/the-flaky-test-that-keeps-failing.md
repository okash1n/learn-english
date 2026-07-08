---
id: the-flaky-test-that-keeps-failing
title: "The Flaky Test That Keeps Failing"
title_ja: "たまに落ちるテストの話"
domain: it
level: [3, 4]
---

I want to tell you about a test that drives me a little crazy. It's one of our automated tests at work. Most of the time it passes, but sometimes it just fails. And then I run it again, and it's green. Don't you hate it when there's no clear reason?

We call this kind of test a flaky test. It's annoying because you can't trust it. When it fails, everyone asks, is the code broken, or is it just the test again? So we waste time checking, and usually the code is fine.

Last week I finally sat down to look at it. I read the test line by line. It turned out the test didn't wait long enough for the data to load. On a fast day, the data was ready. On a slow day, it wasn't, so the test failed. That's it. Such a small thing.

I added a short wait, so the test checks again until the data shows up. Then I ran it about twenty times, and it passed every single time. I'm so glad it's stable now. My teammate said thanks, because that one test was slowing everybody down.

The funny part is, I almost ignored it for months. It's easy to just click run again and move on. But a flaky test is like a small leak. It doesn't stop you today, but it wastes a little time every day. So now I try to fix these early, before they get worse.
