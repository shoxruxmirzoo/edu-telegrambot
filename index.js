// Подкючаем пакет для работы с API Telegram
const TelegramBot = require('node-telegram-bot-api')

// process.env - это переменные окружения
// Устанавливаем адрес сервера, где запущено приложение
const url = process.env.APP_URL || 'https://edu-telegrambot.herokuapp.com/'
// Устанавливаем токен, который выдавал нам бот.
const token = process.env.TOKEN || require('./token.js')

// Включить опрос сервера
const bot = new TelegramBot(
	token,
	// Делаем проверку, если токен приходит с сервера, значит приложение запущено удаленно, и тогда мы меняем конфигурацию запуска
	process.env.TOKEN
		? {
				webHook: {
					// Порт на котором запущено наше приложение
					port: process.env.PORT || 8000,
				},
			}
		: {
				polling: true,
			}
)

// Передаем нашему боту хук, если запус с удаленного сервера
process.env.TOKEN && bot.setWebHook(`${url}/bot${token}`)

// query - переменная запроса, где мы храним данные запросов для всех пользователей
let query = {}
// индекс последнейго вопроса
const lastIndex = 4
// Максимальное число элементов для допольнительной загрузки
// Больше нельзя, т.к. телеграм ограничивает
const maxElements = 40

// Ассинхронная функция, ожидаем пока получим данные (переменная data) для вопросов
require('./src/getInfoForButton.js')(function(data) {
	// Функция выводит сообщение по команде /help
	bot.onText(/\/help/, function(msg, match) {
		chatId = msg.from.id
		bot.sendMessage(
			chatId,
			`📧 Если у Вас есть вопросы и предложения, <a href="https://telegram.me/shtbik">свяжитесь со мной</a>`,
			{
				parse_mode: 'html',
			}
		)
	})

	// Запускает процесс, при вводе пользователя команды /start
	bot.onText(/\/start/, function(msg, match) {
		// Переменная msg содержит инфомацию о получателе и отправителе приходит с сервера, пример:
		// const msg = {
		// 	message_id: 308,
		// 	from: {
		// 		id: 144755140,
		// 		is_bot: false,
		// 		first_name: 'Alexander',
		// 		last_name: 'Shtykov',
		// 		username: 'shtbik',
		// 		language_code: 'ru-RU',
		// 	},
		// 	chatId: {
		// 		id: 144755140,
		// 		first_name: 'Alexander',
		// 		last_name: 'Shtykov',
		// 		username: 'shtbik',
		// 		type: 'private',
		// 	},
		// 	date: 1517752501,
		// 	text: '/start',
		// 	entities: [{ offset: 0, length: 6, type: 'bot_command' }],
		// }

		// Сбрасываем значения от предыдущих владельцев
		clearUserData(msg)

		// По умолчанию индекс вопроса 0, выводим кнопки с предметами
		newQuestion(msg, 0)
	})

	// Функция берет необходимые данные для кнопок по индексу
	function getQuestion(indexQuestion) {
		// Данные (data) приходят из файла ./src/getInfoForButton.js
		// indexQuestion - хранится в каждой кнопке
		return data[indexQuestion]
	}

	// Функция вывода вопроса в чат с отрпавителем
	function newQuestion(msg, indexQuestion) {
		// Получаем нужный вопрос по индексу
		const question = getQuestion(indexQuestion)

		// Получаем заголовок вопроса
		const text = question.title

		// составляем архитектуру вывода кнопок для ответа
		const options = {
			reply_markup: JSON.stringify({
				inline_keyboard: question.buttons,
				parse_mode: 'Markdown',
			}),
		}

		// Получаем id чата, куда отправить сообщение
		chatId = msg.from.id

		// Отправляем сообщение в чат с параметрами
		bot.sendMessage(chatId, text, options)
	}

	// Выводит олимпиады по собранным критериям
	// url - для запроса
	// cnow - счетчик для допольнительной подгрузки
	function getOlympiadsInfo(url, msg, cnow = undefined) {
		require('./src/getInfoAboutOlimpiades.js')(url, function(data, commonCount = ['']) {
			// Регулярное выражение для получения общего числа олимпиад
			const countOlmp = commonCount[0].replace(/\D*\s+\S+/g, '') || 0

			// Получаем id чата
			chatId = msg.from.id

			// Добавляем кнопки, после вывода олимпиад
			function additionalButton(loadmoreFlag) {
				const addButton = [{ text: '↪ Начать заново', callback_data: 'action_repeat' }]
				// Если счетчик cnow переполнен или countOlmp не достаточно большой
				// или loadmoreFlag = false, то не выводим доп. кнопку
				loadmoreFlag &&
					parseInt(countOlmp) > 20 &&
					cnow !== false &&
					addButton.unshift({
						text: '↙ Загрузить еще',
						callback_data: `action_l_${url}_${countOlmp}`,
					})

				const options = {
					reply_markup: JSON.stringify({
						inline_keyboard: [addButton],
						parse_mode: 'Markdown',
					}),
				}

				// Отправляем сообщение
				bot.sendMessage(chatId, 'Выберите действие: ⬇', options)
			}

			// Проверка, получили ли мы олимпиады
			data.length
				? data.forEach(function(olympiad, index) {
						bot
							.sendMessage(
								chatId,
								`${olympiad.classes ? `<b>ℹ ${olympiad.classes}</b>\n\n` : ''}<a href="${
									olympiad.link
								}">🔗 ${olympiad.title}</a>${
									olympiad.description ? `\n\n<b>📚 ${olympiad.description}</b>` : ''
								}${olympiad.rating ? `\n\n<b>⭐ ${olympiad.rating} - рейтинг</b>` : ''}`,
								{
									parse_mode: 'html',
									// disable_web_page_preview: true,
								}
							)
							// callback функцкия, когда выводить доп.кнопки
							.then(() => {
								if (index === data.length - 1) {
									additionalButton(true)
								}
							})
					})
				: (function() {
						bot.sendMessage(chatId, 'К сожалению, по данному запросу мы не нашли олимпиад').then(() => {
							additionalButton(false)
						})
					})()
		})
	}

	// Функция поиска результата и формирования запроса к парсингу
	function searchResult(msg) {
		// Получаем пользовательский запрос
		const userData = query[`user-${msg.from.id}`]

		const { subject = {}, period = {}, type = {}, classNumber = {}, dist = {} } = userData
		const queryTitle = Object.keys(userData).map(function(key, index) {
			return userData[key].title
		})
		// console.log('Result: ', queryTitile.join(', '))

		// Формируем url
		const url = `${subject.value}=on${dist.value ? `&dist=${dist.value}&` : ''}${
			type.value ? `&type=${type.value}` : ''
		}${classNumber.value ? `&class=${classNumber.value}` : ''}${
			period.value ? `&period=${period.value}` : ''
		}`

		chatId = msg.from.id

		// Отправляем подготовленные данные
		getOlympiadsInfo(url, msg)

		// Чистим данные пользовательской сессии
		// clearUserData(msg)
	}

	// Сборщик мусора, удаляем данные пользователя, когда выполнено целевое действие
	function clearUserData(msg) {
		delete query[`user-${msg.from.id}`]
	}

	// Вспомогательная функция (helper) - для преобразования параметров url в формат JSON
	function getUrlVars(url) {
		let hash
		let myJson = {}
		const hashes = url.slice(url.indexOf('?') + 1).split('&')
		for (let i = 0; i < hashes.length; i++) {
			hash = hashes[i].split('=')
			myJson[hash[0]] = hash[1]
		}
		return myJson
	}

	// Функция проверки данных для пользователя
	function checkUserData(msg) {
		return (query[`user-${msg.from.id}`] =
			query[`user-${msg.from.id}`] === undefined ? {} : query[`user-${msg.from.id}`])
	}

	// Функция срабатыващая при нажатии на кнопки бота
	bot.on('callback_query', function(msg) {
		// Вытаскиваю параметры из кнопки
		const answer = msg.data.split('_')
		const index = answer[0]
		const button = answer[1]
		const value = answer[2]
		const param = answer[3]

		// Выводит попап с выбранным значением
		// bot.answerCallbackQuery(msg.id, 'Вы выбрали: ' + value, true)

		// Провека, если уже данные пользователя в памяти
		const queryUser = checkUserData(msg)

		// Смотрю тип действия
		if (index === 'action') {
			switch (button) {
				case 'search':
					return searchResult(msg)
				case 'repeat':
					// Чищу данные, если нажата кнопка "Начать заново"
					clearUserData(msg)
					return newQuestion(msg, 0)
				// case: 'loadmore' потому, что я превысил лимит в 64 байта для передаваемых параметров
				case 'l':
					// Получаю параметры пользователя в формате JSON
					let urlParams = getUrlVars(value)

					// cnow - счетчик выведенных данных
					let { cnow = 0 } = urlParams
					cnow = parseInt(cnow)

					// Логика доп. подгрузки олимпиад
					if (cnow) {
						if (cnow <= param - 20 && cnow <= maxElements) {
							cnow = cnow + 20
						} else {
							cnow = false
						}
					} else {
						cnow = 20
					}

					// Преобразование параметров JSON в формак url query
					let urlString = Object.entries({ ...urlParams, cnow: cnow })
						.map(e => e[0] + '=' + e[1])
						// .map(e => encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1]))
						.join('&')

					// Отправляю данные в функцию получения олимпиады
					return getOlympiadsInfo(urlString, msg, cnow)
				default:
			}
		} else if (index == lastIndex) {
			queryUser[param] = {
				title: value,
				value: button,
			}

			// Отправляю данные в функцию для поиска результатов
			return searchResult(msg)
		}

		// Добавляю новое значение в запрос пользователя
		queryUser[param] = {
			title: value,
			value: button,
		}

		// Вызываю функцию, которая выводит новый вопрос
		newQuestion(msg, parseInt(index) + 1)
	})
})
