# Piparr
An M3U/IPTV proxy server designed to be fast and user friendly. Also with experimental support for multiple providers to power channels.

### Why
Sure, [xTeve](https://github.com/xteve-project/xTeVe) and [TellyTV](https://github.com/tellytv/telly) both exist but I have never been able to get them working for my specific needs. The idea that spawned this project is to create a simple M3U/IPTV proxy where you define channels with multiple providers so that you can have a pool of providers for many people to watch streams.

### Todo
[] - Get client UI working, all testing is done by creating channels directly in SQLite.
[] - Document code, create a wiki, also create an install guide.
[] - Cleanup code, protect against sql injections
[] - Client UI needs to be secured via a password, http auth, token.
[] - Implement stream modes, redirect, proxy, local transcode (via ffmpeg).
[] - Implement connection tracking, don't allow more than allowed streams for provider.
[] - Parse streams and EPG/XMLTV on a separate thread.

### Credit
This project was inspired by [Tunarr](https://github.com/chrisbenincasa/tunarr) and uses its a modified version of its HDHomeRun device service. Also a big thanks to [xTeve](https://github.com/xteve-project/xTeVe) and [TellyTV](https://github.com/tellytv/telly) for their original work on m3u/iptv proxy services for Plex/Jellyfin.