const _ = require('lodash')

function genericError(res, message, status) {
  let response = {
      'status': 'error',
      'message': message ? message : 'General failure',
  };
  return res.status(status ? status: 500).json(response)
}

function genericMessage(res, message, status) {
  let response = {
     'status': 'success',
      'message': message
  };
  return res.status(status ? status: 200).json(response)
}

function genericData(res, data, message, status) {
  let response = {
     'status': 'success',
     'data': data
  };
  if (message) {
    response.message = message
  }
  return res.status(status ? status: 200).json(response)
}

function created(res, data, message) {
  return genericData(res, data, message? message: 'Объект создан', 201)
}

function updated(res, data, message) {
  return genericData(res, data, message? message: 'Объект обновлен', 202)
}

function deleted(res, message) {
  return genericMessage(res, message? message: 'Объект удален', 200)
}

function show(res, data) {
  return genericData(res, data)
}

function list(res, data, meta) {
  let response = {
     'status': 'success',
     'data': data
  };
  if (meta) {
    response.meta = meta
  }
  return res.status(200).json(response)
}

function validationFailed(res, errors, message) {
  let response = {
     'status': 'error',
     'errors': errors
  };
  if (message) {
    response.message = message
  }
  return res.status(422).json(response)
}

function forbidden(res) {
  return genericError(res, 'Недостаточный уровень доступа', 403)
}

function notFound(res) {
  return genericError(res, 'Объект не найден', 404)
}

function unauthorized(res) {
  let response = {
      'status': 'error',
      'message': 'Недоступно без авторизации',
  };
  return res.status(401).json(response)
}

function authorized(res, data, auth, message) {
  let response = {
     'status': 'success',
     data,
     auth
  }
  if (message) {
    response.message = message
  }
  return res.status(200).json(response)

}

module.exports = {
  genericError,
  genericMessage,
  genericData,
  created,
  updated,
  deleted,
  show,
  list,
  validationFailed,
  forbidden,
  notFound,
  unauthorized,
  authorized
}
