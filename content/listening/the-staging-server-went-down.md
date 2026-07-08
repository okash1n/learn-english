---
id: the-staging-server-went-down
title: "The Staging Server Went Down"
title_ja: "ステージング環境が落ちた"
domain: it
level: [5, 6]
---

So this morning started kind of rough. I opened our team chat and everyone was posting the same thing. The staging server was down. Nobody could test their changes on it. It's annoying when that happens, because we've got a release coming this week.

At first I thought it was my laptop, honestly. I refreshed the page a few times and got nothing. But then I saw the messages, and I felt a bit better. It wasn't just me. The whole team was stuck.

My teammate Ravi jumped in and started checking the logs. I'm glad he did, because he's really good at that stuff. It turned out the server just ran out of disk space. Some old test files kept piling up and never got deleted. So the server basically gave up.

We cleaned up the old files and restarted it. That took maybe twenty minutes, but it felt longer. Everyone was waiting and asking if it was back yet. When the page finally loaded again, I actually said thank you out loud at my desk.

After that, we talked about how to stop it from happening again. Ravi wants to add a small job that clears the old files every night. I think that's a smart idea. Don't you hate it when the same problem comes back twice? So for now, staging is happy, and so am I.
