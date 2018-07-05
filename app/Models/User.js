'use strict'

const Model = use('Model')
const passwordValidator = use('password-validator')
const { validate } = use('Validator')
const Database = use('Database')
const moment = use('moment')

class User extends Model {
  static boot () {
    super.boot()

    /**
     * A hook to hash the user password before saving
     * it to the database.
     *
     * Look at `app/Models/Hooks/User.js` file to
     * check the hashPassword method
     */
    this.addHook('beforeCreate', 'User.validateOnCreate')
    this.addHook('beforeUpdate', 'User.validateOnUpdate')

    this.addHook('beforeCreate', 'User.hashPassword')
    this.addHook('beforeCreate', 'User.setVerificationToken')
    this.addHook('beforeCreate', 'User.setStatusNew')
  }

  static get visible () {
    return ['id', 'username', 'email', 'no_subscriptions', 'about', 'status', 'level']
  }

  static query () {
    let query = super.query().whereNull('deleted_at')
    return query
  }

  static async passwordValidation (data) {
    // Проверка - для нового пользователя, и для случая, когда меняют пароль
    const rules = {
      password: 'required',
      password_confirmation: 'required_if:password|same:password'
    }
    const validation = await validate(data, rules)
    if (validation.fails()) {
      return validation.messages() // Список ошибок в случае провала
    } else {
      // Еще проверочка - сильный пароль или нет
      if (process.env.STRONG_PASSWORDS) {
        if (!User.strongPassword(data.password)) {
          // Имитируются данные от ошибки валидатора
          return  [{
            'field': 'password',
            'validation': 'strength',
            'message': 'Пароль должен быть длиннее 6 знаков, состоять из цифр и латиницы'
          }]
        }
      } else {
        return false
      }
    }
  }

  static strongPassword (password) {
    const schema = new passwordValidator()
    schema
      .is().min(6)
      .is().max(12)
      .has().letters()
      .has().digits()
      .has().not().spaces()
    return schema.validate(password)
  }

  static get basic() {
    return 1
  }
  static get advanced() {
    return 2
  }
  static get maximum() {
    return 5
  }
  static get admin() {
    return 6
  }
  static get super() {
    return 10
  }
}

module.exports = User
