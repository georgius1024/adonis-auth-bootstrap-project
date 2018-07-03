'use strict'

const Schema = use('Schema')

class MessagesSchema extends Schema {
  up () {
    this.create('messages', (table) => {
      table.increments()
      table.integer('hidden').notNullable().defaultTo('0')
      table.timestamp('at').notNullable().default('0000-00-00 00:00:00')
      table.integer('sender_id').notNullable().defaultTo('0')
      table.string('subject').notNullable()
      table.string('template').notNullable()
      table.string('layout').notNullable()
      table.text('body', 'long')
      table.text('markdown', 'long')
      table.text('blocks', 'long')
      table.string('action_url')
      table.string('action_name')
      table.text('attachments', 'long')
      table.text('recipients', 'long')
      table.integer('priority')
      table.string('status')
      table.timestamps()
      table.timestamp('deleted_at').nullable().defaultTo(null)
      table.index(['hidden', 'priority', 'at'])
      table.charset('utf8')
    })
  }

  down () {
    this.drop('messages')
  }
}

module.exports = MessagesSchema
