'use strict'

const _ = use('lodash')
const uuidv1 = require('uuid/v1');

const Hash = use('Hash')
const Database = use('Database')

const User = use('App/Models/User')
const Response = use('App/Lib/Response')
const MailComposer = use('App/Lib/MailComposer')

class AuthController {
  async loginTraditional ({ auth, request, response, view }) {
    const email = request.input('email')
    const password = request.input('password')
    try {
      const user = await auth.validate(email, password, true)

      if (user.status === 'reset') {
        // Если запросил сброс, потом вспомнил пароль и зашел, то
        // продолжаем работать, не требуя смены пароля
        user.status = 'active'
        await user.save()
      }
      if (user.status === 'new') {
        // Повторить письмо с активацией
        this.sendWelcomeEmail (view, user)
        return Response.genericError(response, 'Пожалуйста, активируйте учетную запись, перейдя по ссылке в письме!', 422)
      }
      const token = await auth.generate(user, true)
      return Response.authorized(
        response,
        this.publicProfile(user.toJSON()),
        token,
        'Добро пожаловать обратно, ' + user.username)
    } catch (e) {
      if (e.name === 'PasswordMisMatchException') {
        return Response.genericError(response, 'Неверный пароль!', 422)
      } else if (e.name === 'UserNotFoundException') {
        return Response.genericError(response, 'Неверный логин!', 422)
      } else {
        throw e
      }
    }
  }


  async loginPasswordless ({ view, request, response }) {
    const email = request.input('email')
    if (email) {
      const user = await User.findBy('email', email)
      if (user) {
        await this.sendLoginEmail(view, user)
        return Response.genericMessage(response, 'Отправлено письмо со ссылкой для входа в приложение')
      } else {
        return Response.genericError(response, 'Неверный email!', 422)
      }
    } else {
      return Response.genericError(response, 'Отсутствует email!', 422)
    }
  }

  async loginOnce ({ params, auth, request, response }) {
    const code = params.code
    const user = await User.findBy('verification_code', code)
    if (!user) {
      return Response.genericError(response, 'Эта одноразовая ссылка уже была использована!', 401)
    }
    user.verification_code = uuidv1()
    if (user.status === 'new') {
      user.status = 'active'
    }
    await user.save()
    const token = await auth.generate(user, true)
    return Response.authorized(
      response,
      this.publicProfile(user.toJSON()),
      token,
      user.status === 'reset' ? 'Сейчас необходимо установить новый пароль' : 'Добро пожаловать, ' + user.username)
  }

  async register ({ auth, request, response, view }) {

    if (!Number(process.env.REGISTRATION)) {
      return Response.genericError(response, 'Регистрация остановлена', 422)
    }

    const data = request.only(['username', 'email', 'password', 'password_confirmation', 'about'])
    data.level = User.basic //<--- ПЕРВОНАЧАЛЬНЫЙ УРОВЕНЬ

    let errors = await User.passwordValidation(data)
    if (errors) {
      return Response.validationFailed(response, errors, 'Проблема')
    }
    delete data['password_confirmation']
    let user = new User()
    try {
      user.fill(data)
      await user.save()
    } catch (e) {
      console.log(e)
      return Response.validationFailed(response, user.errors, e.message)
    }

    this.sendWelcomeEmail (view, user)
    return Response.genericMessage(
      response,
      'Для завершения регистрации, пожалуйста, пройдите по ссылке, высланной на Ваш e-mail. Если письмо не пришло, посмотрите, пожалуйста, в папке "Спам".')
  }

  async mailActivate ({ params, response }) {
    const code = params.code
    const user = await User.findBy('verification_code', code)
    if (user && user.status === 'new') {
      user.status = 'active'
      try {
        await user.save()
        return this.callFrontendActivator(user.level < User.admin, `once=${code}`, response)
      } catch (e) {
        console.log(e)
        return Response.genericError(response, e.message)
      }
    } else {

      return this.callFrontendActivator(true, `once=${code}`, response)
    }
  }

  async showProfile ({ auth, request, response }) {
    if (auth.user) {
      return Response.genericData(
        response,
        this.publicProfile(auth.user.toJSON()))
    } else {
      return Response.unauthorized(response)
    }
  }

  async updateProfile ({ auth, request, response }) {
    const user = await User.findOrFail(auth.user.id)
    const data = request.only(['name', 'email', 'about'])

    try {
      user.merge(data)
      await user.save()
    } catch (e) {
      console.log(e)
      return Response.validationFailed(response, user.errors, e.message)
    }
    const token = await auth.generate(user, true)
    return Response.authorized(
      response,
      this.publicProfile(user.toJSON()),
      token,
      'Профайл обновлен')
  }

  async changePassword ({ auth, request, response }) {
    const user = await User.findOrFail(auth.user.id)
    const oldPassword = request.input('old-password')

    if (!await Hash.verify(oldPassword, user.password)) {
      return Response.genericError(response, 'Старый пароль введен неправильно', 422)
    }
    const data = request.only(['password', 'password_confirmation'])
    let errors = await User.passwordValidation(data)
    if (errors) {
      return Response.validationFailed(response, errors, 'Проблема')
    }

    user.password = await Hash.make(data.password)
    await user.save()
    return Response.genericMessage(response, 'Пароль изменен')
  }

  async forgotPassword ({ params, view, request, response }) {
    const email = params.email
    const user = await User.findBy('email', email)

    if (user) {
      await this.sendResetEmail (view, user)
      return Response.genericMessage(response, 'Отправлено письмо со ссылкой для восстановления пароля')
    } else {
      return Response.genericError(response, 'Неверный email!', 422)
    }

  }

  async mailResetPassword ({ params, request, response }) {
    const code = params.code
    const user = await User.findBy('verification_code', code)
    if (user) {
      user.status = 'reset'
      await user.save()
      return this.callFrontendActivator(user.level < User.admin, `once=${code}`, response)
    } else {
      return this.callFrontend(true, response)
    }

  }

  async resetPassword ({ auth, request, response }) {
    const user = auth.user

    const data = request.only(['password', 'password_confirmation'])

    let errors = await User.passwordValidation(data)
    if (errors) {
      return Response.validationFailed(response, errors, 'Проблема')
    }
    user.password = await Hash.make(data.password)
    user.status = 'active'
    await user.save()
    const token = await auth.generate(user, true)
    return Response.authorized(
      response,
      this.publicProfile(user.toJSON()),
      token,
      'Добро пожаловать назад, ' + user.username)
  }

  publicProfile (user) {
    return _.omit(user, ['password', 'verification_code', 'updated_at'])
  }

  callFrontendActivator(isPublic, endpoint, response) {
    if (isPublic) {
      return response.redirect(`${process.env.SITE}/${process.env.ACTIVATOR}?${endpoint}`)
    } else {
      return response.redirect(`${process.env.ADMIN}/#${process.env.ACTIVATOR}?${endpoint}`)
    }
  }

  callFrontend(isPublic, response) {
    return response.redirect(`${process.env.PUBLIC}`)
  }

  async unsubscribe ({ request, response}) {
    let userId = request.params.user
    let messageId = request.params.message
    try {
      const user = await User.findOrFail(userId)
      user.no_subscriptions = 1
      await user.save()
      await Database.raw(`update message_recipients 
        set delivery_status='unsubscribe', delivery_report='Пользователь отписался', updated_at=now()
        where id='${messageId}'`)
      return this.callFrontendActivator(true, `unsubscribe=${request.params.user}`, response)
    } catch (error) {
      return Response.genericError(response, error.message)
    }

  }

  async sendWelcomeEmail (view, user) {
    let frontend = `${process.env.PUBLIC}`
    let actionUrl = `${process.env.BACKEND}/mail/activate/${user.verification_code}`
    let data = {
      user: this.publicProfile(user.toJSON()),
      frontend,
      actionUrl
    }
    const rawBody = MailComposer.generateMessage(view, data, 'emails.welcome')
    const styled = MailComposer.styleMessage(rawBody)
    MailComposer.sendMessage(user.email, user.name, 'Подтверждение учетной записи', styled)
  }

  async sendLoginEmail (view, user) {
    let frontend = `${process.env.PUBLIC}`
    let actionUrl = `${process.env.BACKEND}/mail/activate/?once=${user.verification_code}`
    let data = {
      user: this.publicProfile(user.toJSON()),
      frontend,
      actionUrl
    }
    const rawBody = MailComposer.generateMessage(view, data, 'emails.welcome')
    const styled = MailComposer.styleMessage(rawBody)
    MailComposer.sendMessage(user.email, user.name, 'Ваша ссылка для входа в приложение', styled)
  }

  async sendResetEmail (view, user) {
    let frontend = `${process.env.PUBLIC}`
    let actionUrl = `${process.env.BACKEND}/mail/reset/${user.verification_code}`
    let data = {
      user: this.publicProfile(user.toJSON()),
      frontend,
      actionUrl
    }
    const rawBody = MailComposer.generateMessage(view, data, 'emails.reset')
    const styled = MailComposer.styleMessage(rawBody)
    MailComposer.sendMessage(user.email, user.name, 'Восстановление учетной записи', styled)
  }

}

module.exports = AuthController

