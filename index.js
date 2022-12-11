const config = require('./config.js');
const mysql = require('mysql2');
const axios = require('axios').default;

let access_token = null; // Токен авторизации
let pages_count = 0; // Ограничение на кол-во обрабатываемых страниц (0 - нет ограничения)
let page = 1; // Счетчик страниц
let auto = []; // Строки для записи в БД

const connection = mysql.createConnection(config.db);

// Соединение с БД
connection.connect(function (error) {
    if (error) {
        console.log('Connection Failed');
        throw error;
    }

    // Создание таблицы, если отсутствует
    connection.execute('CREATE TABLE IF NOT EXISTS `cmexpert`.`auto` ( `id` INT NOT NULL AUTO_INCREMENT , `name` VARCHAR(50) NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;',
        function (error) {
            if (error) {
                throw err;
            }
        });

    // Авторизация в CM.Expert API
    axios.post(config.cme.urls.auth, {
        grant_type: 'client_credentials',
        client_id: config.cme.client_id,
        client_secret: config.cme.client_secret
    })
        .then(function (response) {

            access_token = response.data.access_token; // Получаем токен авторизации

            getAutoPerPage(); // Сбор информации об автомобилях

        })
        .catch(function (error) {
            console.log(error);
        });

});

// Обработка автомобилей с одной страницы
function getAutoPerPage () {

    axios.get(config.cme.urls.stock, {
        params: {
            page,
            perPage: 50
        },
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    })
        .then(function (response) {

            if (pages_count === 0) {
                pages_count = response.headers['x-pagination-page-count']; // Сохранение кол-во страниц из заголовка ответа
            }

            response.data.forEach(a => {
                auto.push((a.brand ? a.brand.replace('\'', '\'\'') : '') + ' ' +
                    (a.model ? a.model.replace('\'', '\'\'') : '') + ' ' +
                    a.year)
            });

            storeAuto()
            auto = [];

            page++;

            if (page <= pages_count) {
                getAutoPerPage()
            }
            else {
                connection.end();
            }

        })
        .catch(function (error) {
            console.log(error);
        });
}

// Запись всех полученных строк в БД
function storeAuto () {

    let values = '(\'' + auto.join('\'),(\'') + '\')';

    connection.query(`INSERT INTO auto (name) VALUES ${values}`, (error) => {
        if (error) {
            console.log(error);
        };
    });
}