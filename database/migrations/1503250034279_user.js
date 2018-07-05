'use strict'

const Schema = use('Schema')

class UserSchema extends Schema {
  up () {
    this.create('users', table => {
      table.increments()
      table.string('username', 255).notNullable()
      table.string('email', 255).notNullable().unique()
      table.integer('level').notNullable()
      table.string('status', 10).notNullable(),
      table.string('verification_code', 80).notNullable()
      table.string('password', 80).notNullable()
      table.string('about', 255)
      table.timestamps()
      table.timestamp('deleted_at').nullable().defaultTo(null)
    })
  }
  down () {
    this.drop('users')
  }
}

module.exports = UserSchema
