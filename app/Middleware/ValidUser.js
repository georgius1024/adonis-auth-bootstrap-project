'use strict'
const User = use('App/Models/User')

class ValidUser {
  async handle ({auth, request }, next) {
    const user = auth.user
    if (user.level < User.admin && user.status === 'active') {
      return await next()
    }
    if (user.level >= User.admin) {
      throw new Error('Нельзя войти в клиентский раздел под логином администратора')
    } else if (user.status === 'new') {
      throw new Error('Вы не активировали аккаунт. Проверьте почтовый ящик, найдите письмо с активацией и кликните по ссылке. Account not activated!')
    } else if (user.status === 'reset') {
      throw new Error('Необходимо сменить пароль. Need change password!')
    } else {
      throw new Error('Вход закрыт администратором! Access restricted!')
    }
  }
}

module.exports = ValidUser
