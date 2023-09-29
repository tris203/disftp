# DisFTP - An (Unoffical) FTP Implementation of Disbox
### Disbox: https://github.com/DisboxApp/web/

This is an implementation of FTP-SRV (https://github.com/QuorumDMS/ftp-srv) using a custom Virtual Filesystem based on the connector from the Disbox Project.
It uses their APIs for access and read/write.

# Features
[x] File List
[x] Downloading Files (Files are streamed from web)
[x] Uploading Files, file is uploaded locally to the server then uploaded through the Discord Webhook. (This can be improved in future to stream the data directly and upload directly without a temp file)
[x] Renaming Files (This needs more work, as it will currently let you rename directories, which is not supported by Disbox currently)
[ ] Deleting Files

# Usage
1. Clone the repository
2. ```npm i ```
3. ```npm run start```
4. Run index.js
5. Log in to the FTP server with credentials from your Discord Webhook for Disbox
    1. Username is the numerical section
    2. Password is the longer string
6. Use your Disbox storage via FTP

# Usage via Docker
The package is also updated and pushed to DockerHub https://hub.docker.com/r/tris203/disftp
Please note, that the network will need to be in a Custom mode with a local IP address to use Active Mode.
If your docker is in Bridge mode then you will need to use a Passive Connection in your FTP Client

# Credit to Disbox
The majority of the disbox-file-manager.js code is taken directly from their repository, with just a few minor adjustments to handle Buffers over Blobs.
All credit goes to DisBox for that implementation and code.

# Contributions

All contributations are welcome, please take a look at the list above or issues/discussions and get involved