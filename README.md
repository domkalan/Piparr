# Piparr
[![GitHub license](https://img.shields.io/github/license/domkalan/piparr.svg)](https://github.com/domkalan/piparr/blob/master/LICENSE) [![GitHub release](https://img.shields.io/github/release/domkalan/piparr.svg)](https://GitHub.com/domkalan/piparr/releases/) [![GitHub Actions](https://github.com/domkalan/piparr/actions/workflows/test.yml/badge.svg)](https://github.com/domkalan/piparr/actions/)

An M3U/IPTV proxy server designed to be fast and user friendly. Also with experimental support for multiple stream sources to provide media to channels.

### Why
Sure, [xTeve](https://github.com/xteve-project/xTeVe) and [TellyTV](https://github.com/tellytv/telly) both exist but I have never been able to get them working for my specific needs. The idea that spawned this project is to create a simple M3U/IPTV proxy where you define channels with multiple stream sources so that you can have a pool of "providers" for many people to watch streams. An example would be a channel can primarily source content from a premium stream, but then fallback on a backup stream once connection capacity has been reached or the primary source goes down.

### Setup
For the most up to date ways to install, checkout the [setup guide](https://github.com/domkalan/Piparr/wiki#setup-guide) on the wiki. The easiest way to currently setup and get Piparr running is via Docker.
```bash
sudo docker pull ghcr.io/domkalan/piparr:latest
sudo docker run -d --name piparr --restart always -v /opt/piparr-data:/app/data -p 34400:34400 ghcr.io/domkalan/piparr:latest
```

### Todo
- [x] - Get client UI working.
- [x] - Parse streams and EPG/XMLTV on a separate thread.
- [x] - Periodically save parsed streams to disk for faster startup.
- [x] - Document code, create a wiki, also create an install guide.
- [x] - Add missing comments to source code.
- [x] - Cleanup code, protect against sql injections.
- [x] - Regex filtering for large stream providers.
- [ ] - Implement stream modes, redirect, proxy, local transcode (via ffmpeg). *(in progress)*
- [ ] - Client UI needs to be secured via a password, http auth, token.
- [ ] - Implement connection tracking, don't allow more than allowed streams for provider.


### Credit
This project was inspired by [Tunarr](https://github.com/chrisbenincasa/tunarr) and uses its a modified version of its HDHomeRun device service. Also a big thanks to [xTeve](https://github.com/xteve-project/xTeVe) and [TellyTV](https://github.com/tellytv/telly) for their original work on m3u/iptv proxy services for Plex/Jellyfin.

### License
Piparr is licensed under the [Zlib license](https://github.com/domkalan/Piparr/blob/main/LICENSE).