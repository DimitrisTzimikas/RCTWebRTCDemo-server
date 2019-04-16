# RCTWebRTCDemo-server

## Download ngrok
- download: [ngrok](https://ngrok.com/)
- install

## Usage
- open cmd
- `npm install`
- `node app`

## Instructions
- After you start the server, open cmd and navigate to ngrok download folder
- run ```ngrok http 4443```
- if everything correct this must be the result 
```
ngrok by @inconshreveable                                  (Ctrl+C to quit)

Session Status                online
Session Expires               6 hours, 43 minutes
Version                       2.3.25
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://a4cd7858.ngrok.io -> http://localhost:
Forwarding                    https://a4cd7858.ngrok.io -> http://localhost

Connections                   ttl     opn     rt1     rt5     p50     p90
                              40      0       0.00    0.00    6.99    667.2

HTTP Requests
-------------

GET /socket.io/                101 Switching Protocols
```

- Copy paste the https://a4cd... (whatever your link  is) and go to **RCTWebRTCDemo** to paste the link