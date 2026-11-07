# Add project keys

Most projects are ready without any setup. When a project needs a key:

1. Tap **Add keys** in your private studio project post.
2. Open the private page, paste your `.env` text, and tap **Save keys**.
3. Head back to your project. The card changes to **Keys added ✓**, and a waiting deploy continues automatically.

The page shows which names are already added. Saved values are never displayed. Your private link lasts ten minutes; tap the button again for a fresh one.

Use **Update keys** in the project post to change its keys. Use **Update shared keys** in the studio’s **Keys** post for keys every project inherits. Project keys override shared keys. Paste `NAME=` to remove a project override and use the shared value again.

Keep your own copy in `pass`. Never paste values into Discord or an AI chat. The AWS console’s Parameter Store is available as a fallback: use `/backroom/production/<project>/env` or `/backroom/production/shared/env`, Standard SecureString with the default key. Console edits take effect when the app next starts.
