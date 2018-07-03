'use strict'
const User = use('App/Models/User')

class ValidAdmin {
  async handle ({auth, request }, next) {
    const user = auth.user
    if (user.level >= User.admin && user.status === 'active') {
      return await next()
    }
    if (user.level < User.admin) {
      throw new Error('Это не можете использовать это приложение!')
    } else if (user.status === 'reset') {
      throw new Error('Необходимо сменить пароль. Need change password!')
    } else {
      throw new Error('Вход закрыт администратором! Access restricted!')
    }
  }
}

module.exports = ValidAdmin
