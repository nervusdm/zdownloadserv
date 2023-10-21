# ZDownload Server

This server works in tandem with the [ZServDownload Chrome extension](https://github.com/nervusdm/ZServDownload) to make downloading files from URLs easier.

## Prerequisites

- Node.js
- npm

## Installation

Clone the repository and install dependencies.

\`\`\`bash
git clone https://github.com/nervusdm/zdownloadserv.git
cd zdownloadserv
npm install
\`\`\`

### **Important: Security Note**
The `config.ini` file is included in the repository. Make sure to change the `token_pass` in `config.ini` to something secure before running the server.

## Running the Server

\`\`\`bash
node index.js
\`\`\`

### Recommended: Using PM2

We recommend using [PM2](https://pm2.keymetrics.io/) to keep your server running in the background.

Install PM2:

\`\`\`bash
npm install pm2 -g
\`\`\`

Start the server with PM2:

\`\`\`bash
pm2 start index.js
\`\`\`

## Usage

1. Start the ZDownload Server.
2. Install the [Zdownloadchrome Chrome extension](https://github.com/nervusdm/zdownloadchrome).
3. Configure the extension to connect to your ZDownload Server.

## Features

- Secure token-based authentication.
- List all downloaded files.
- Download files directly from your browser.
- Delete downloaded files.

