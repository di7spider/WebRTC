https://www.npmjs.com/package/nodemon  - (модуль) nodemon следит за изменениями в файлах и перегружает сервер
https://github.com/remy/nodemon - команды nodemon
https://www.npmjs.com/package/forever - (модуль) forever выполняет скрипт из под консоли
https://github.com/foreverjs/forever - команды forever
https://github.com/felixge/node-mysql - MySQL
http://docs.sequelizejs.com/en/latest/docs/getting-started/#installation - ORM для MySQL

forever start -c nodemon app.js 8090 --ignore client/ - старт
forever stop -c nodemon app.js 8090 --ignore client/ - стоп

ps aux | grep node - поиск процессов node

node /var/www/webrtc.iconix.ru/app.js > /var/www/webrtc.iconix.ru/stdout.txt 2> /var/www/webrtc.iconix.ru/stderr.txt &


---------------
0) node.exe cd /d F:\Develop\WebRtc
1) npm install
2) node app
3) http://localhost:8090/