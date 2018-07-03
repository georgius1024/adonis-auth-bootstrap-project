'use strict'
const User = use('App/Models/User')
const Response = use('App/Lib/Response')
const RestController = use('App/Lib/RestController')
const uuidv1 = require('uuid/v1');
const Database = use('Database')
const moment = use('moment')

class UserController {
  constructor () {
    this.rest = new RestController(User,
      {
        fieldList: 'id, username, email, about, level, status',
        sortable: ['id', 'username', 'email', 'about'],
        searchable: ['username', 'email', 'about'],
        softDeletes: true,
        defaultSortBy: 'username',
        highlightClass: 'primary',
        createdMessage: 'Пользователь создан',
        updatedMessage: 'Пользователь обновлен',
        deletedMessage: 'Пользователь удален',
        onAfterAnySave: async (data, original, rest, record, request) => {
          if (record.status === 'new') {
            record.status = 'active'
            record.save()
          }
        },
        onBeforeDelete: async (data, rest) => {
          data.email = '.' + uuidv1() + '.' + data.email
        }
      }
    )
  }

  async index ({ request, response }) {
    if (request.input('filter')) {
      let filter = JSON.parse(request.input('filter'))
      if (filter === 'public') {
        this.rest.config.filter = ['level<' + User.admin]
      } else if (filter === 'staff') {
        this.rest.config.filter = ['level>=' + User.admin]
      }
    } else {
      delete this.rest.config.filter
    }

    return this.rest.index(request, response)
  }

  async show ({ request, response }) {
    return this.rest.show(request.params.id, request, response)
  }

  async store ({ request, response }) {
    const data = request.only(['password', 'password_confirmation'])
    let errors = await User.passwordValidation(data)
    if (errors) {
      return Response.validationFailed(response, errors, 'Проблема')
    }

    return this.rest.store(
      request.only(['username', 'email', 'about', 'password', 'level']),
      request,
      response)
  }

  async update ({ request, response }) {
    if (request.input('new_password')) {
      const data = request.only(['password', 'password_confirmation'])
      let errors = await User.passwordValidation(data)
      if (errors) {
        return Response.validationFailed(response, errors, 'Проблема')
      }
    }
    return this.rest.update(
      request.params.id,
      request.only(['username', 'email', 'about', 'level']),
      request,
      response)
  }

  async destroy ({ request, response }) {
    return this.rest.destroy(
      request.params.id,
      request,
      response)
  }

}

module.exports = UserController
