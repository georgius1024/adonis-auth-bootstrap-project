'use strict'

const Schema = use('Schema')

class MessageDeliverySchema extends Schema {
  up () {
    this.create('message_recipients', (table) => {
      table.increments()
      table.integer('message_id')
      table.integer('user_id')
      table.string('email')
      table.string('delivered_at')
      table.string('delivery_status')
      table.text('delivery_report', 'long')
      table.timestamp('seen_at').nullable().defaultTo(null)
      table.timestamps()
      table.timestamp('deleted_at').nullable().defaultTo(null)
      table.index(['message_id', 'delivered_at', 'user_id'])
      table.charset('utf8')
    })
  }

  down () {
    this.drop('message_recipients')
  }
}

module.exports = MessageDeliverySchema
