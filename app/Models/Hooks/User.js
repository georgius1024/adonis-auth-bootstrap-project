'use strict'

const Hash = use('Hash')
const Logger = use('Logger')
const uuidv1 = require('uuid/v1');
const { validate } = use('Validator')

const UserHook = module.exports = {}

UserHook.hashPassword = async (instance) => {
  if (instance.password) {
    instance.password = await Hash.make(instance.password)
  }
}

UserHook.setVerificationToken = async (instance) => {
  if (!instance.verification_code) {
    instance.verification_code = uuidv1()
  }
}

UserHook.setStatusNew = async (instance) => {
  if (!instance.status) {
    instance.status = 'new'
  }
}

UserHook.validateOnCreate = async (instance) => {
  if (!instance.deleted_at) {
    const errors =
      await basicValidation(instance) ||
      await uniqueEmailValidation(instance)
    if (errors) {
      instance.errors = errors
      Logger.debug(errors)
      throw new Error('Проблема с данными')
    }
  }
}

UserHook.validateOnUpdate = UserHook.validateOnCreate

async function basicValidation(instance) {
  const rules = {
    username: 'required',
    email: 'required|email',
    level: 'required|integer',
  }
  const validation = await validate(instance.toJSON(), rules)
  if (validation.fails()) {
    return validation.messages() // Список ошибок в случае провала
  } else {
    return false
  }
}

async function uniqueEmailValidation(instance) {
  const rules = {
    email: 'unique:users'
  }
  if (instance.id) {
    rules.email = `unique:users,email,id,${instance.id}`
  }
  const validation = await validate(instance.toJSON(), rules)
  if (validation.fails()) {
    let messages = [{
      message: 'Email должен быть уникальный. Если это ваш Email, просто перелогиньтесь',
      field: 'email',
      validation: 'inique'
    }]
    Logger.info(messages, 'fuckup')
    return messages
  } else {
    return false
  }
}
