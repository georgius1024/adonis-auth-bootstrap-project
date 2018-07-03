/// Конфигурации REST
/// model - просто модель
/// Объект config
/// fieldList - список полей (строка, через запятую или массив с названиями || ничего == *
/// dataSource - источник (имя таблицы или join) || ничего == модель
/// sortable - массив со списком сортируемых полей || ничего == без сортировки
/// searchable - массив со списком полей для поиска || ничего == без поиска
/// filter - валидное SQL-выражение - осторожно, включается в SQL без проверки
/// columnAliases - массив подстановки полей {'client': 'cl.name'} || ничего == без могут быть проблемы пр поиске/сортировке колонок с префиксами
/// defaultSortBy, defaultSortOrder - сортировка по умолчанию || ничего == сортировка по PK
/// highlightClass или highlightColor - подсветка подстроки в результатах поиска || ничего == без подсветки
/// softDeletes - поддержка deleted_at столбца
/// rows - кол-во строк на страницу по умолчанию || 10
/// если передана строка, то он используется как префикс таблицы
/// softDeletes = 'e' => ...and e.deleted_at is null...
/// softDeletes = true => ...and table-name.deleted_at is null...
/// Хуки (тоже в конфиге)
/// onTransformRow - преобразовать строку таблицы при выдаче пользователю Index-а
/// onShow -  - преобразовать строку таблицы при выдаче пользователю Show-а
/// onBeforeStore, onBeforeUpdate, onAfterStore, onAfterUpdate,
/// onBeforeDelete, onAfterDelete
/// onBeforeAnySave, onAfterAnySave
/// onTransformPage (async) всю страницу обрабатывает сразу поле получения из базы
/// onBuildCache onClearCache события кэша (древовидные структуры)
/// параметры запроса
/// page - номер страницы (1..N) || ничего == первая
/// rows - строк на странцу || ничего == 10
/// search - найти подстроку || ничего == нет поиска
/// find - найти определенный код || ничего == нет поиска и намного быстрее
/// sort, order - сортировка || ничего == сортировка по конфигу
/// Расширения для деревьев
/// tree - включить поддержкe деревьев || без поддержки деревьев
/// parent - поле с кодом родителя || parent
/// orderColumn - поле с порядковым номером || pos
/// childrenCount - поле, куда поместить подсчет кол-ва детенышей || не считать детей
///
const _ = use('lodash')
const moment = use('moment')
const Database = use('Database')
const Logger = use('Logger')
const Response = use('App/Lib/Response')
const Cache = use('Cache')

class RestController {
  constructor (model, config) {

    if (!model) {
      throw new Error('model is required')
    }
    if (!config) {
      throw new Error('config is required')
    }
    this.model = model
    this.config = config

    if (this.config.tree) {
      this.usingCache = true
    }
  }

  translate (field) {
    if (_.has(this.config, 'columnAliases.' + field)) {
      return this.config.columnAliases[field]
    } else {
      return field
    }
  }

  async query(sql) {
    await Database.raw(sql)
  }

  async selectAll (sql) {
    let raw = await Database.raw(sql)
    if (raw) {
      return raw[Object.keys(raw)[0]]
    }
  }

  async selectRow (sql) {
    let rows = await this.selectAll(sql)
    if (rows) {
      return rows[Object.keys(rows)[0]]
    }
  }

  async selectField (sql) {
    let row = await this.selectRow(sql)
    if (row) {
      return row[Object.keys(row)[0]]
    }
  }

  async index (request, response) {
    // Выборка из конфига/модели
    // fieldList может быть строкой, массивом или ничем
    let fieldList = this.config.fieldList
      ? (
          Array.isArray(this.config.fieldList) ? this.config.fieldList.join(',') : this.config.fieldList
        )
      : '*'
    let dataSource = this.config.dataSource ? this.config.dataSource : this.model.table
    let sortable = this.config.sortable ? this.config.sortable : []
    let searchable = this.config.searchable ? this.config.searchable : []
    let aliases = this.config.columnAliases ? this.config.columnAliases : []

    // Параметры запроса
    let page = request.input('page', 1)
    let rows = request.input('rows', this.config.rows ? this.config.rows : 10)
    let search = request.input('search')
    let find = request.input('find')
    let sort = request.input('sort', this.model.primaryKey)
    let order = request.input('order', 'asc')

    if (this.config.tree) {
      // Поддержка деревьев
      rows = 1000 // Не более 1000 строк за раз
      sort = this.config.orderColumn || sort
      order = 'asc'
    }
    // Сортировка
    let sortExpression
    if (this.config.tree && this.config.orderColumn) {
      sortExpression = 'order by ' + this.translate(this.config.orderColumn)
    } else if (sort && sortable.indexOf(sort) >= 0) {
      sortExpression = 'order by ' + this.translate(sort) + ' ' + order
    } else if (this.config.tree && this.config.posKey) {
      sortExpression = 'order by ' + this.model.posKey + ' asc'
    } else if (this.config.defaultSortBy) {
      sortExpression = 'order by ' + this.translate(this.config.defaultSortBy) + ' ' +
        (this.config.defaultSortOrder ? this.config.defaultSortOrder : 'asc')
    } else if (this.model.primaryKey) {
      sortExpression = 'order by ' + this.model.primaryKey + ' asc'
    }

    // Поиск
    let searchExpression
    if (search) {
      let raw = searchable.map(field => `${this.translate(field)} like '%${search}%'`)
      if (raw.length) {
        searchExpression = '(' + raw.join(' or ') + ')'
      }
    }
    

    // Фильтр
    let filterExpression
    if (Array.isArray(this.config.filter) && this.config.filter.length) {
      filterExpression = '(' + this.config.filter.join(' and ') + ')'
    }

    let softDeletesExpression
    if (this.config.softDeletes) {
      if (typeof this.config.softDeletes === 'string') {
        softDeletesExpression = `(${this.config.softDeletes}.deleted_at is null)`
      } else {
        softDeletesExpression = `(${this.model.table}.deleted_at is null)`
      }

    }

    let parentExpression
    if (this.config.tree) {
      let parent = this.config.parent || 'parent'
      if (request.input(parent)) {
        let parentId = Number(request.input(parent))
        parentExpression = `${parent}=${parentId}`
      }
    }

    // Суммарное условие отбора фильтр + поиск
    let whereExpression = [searchExpression, filterExpression, softDeletesExpression, parentExpression]
      .filter(e => Boolean(e))
      .join(' and ')
    if (whereExpression) {
      whereExpression = 'where ' + whereExpression
    }

    // Пагинация
    let meta = {
      per_page: Number(rows),
      current_page: Number(page)
    }

    let SQL = ''
    try {
      // Запрос 1 - общее количество
      SQL = `select count(*) from ${dataSource} ${whereExpression}`
      meta.total = await this.selectField(SQL)
      if (meta.total) {
        meta.last_page = Math.ceil(meta.total / meta.per_page)
        // Корректировка номера страницы
        if (meta.current_page > meta.last_page) {
          meta.current_page = meta.last_page
        }
      } else {
        meta.current_page = 1
        meta.last_page = 1
        meta.total = 0
      }

      meta.from = meta.per_page * (meta.current_page - 1) + 1
      meta.to = meta.per_page * meta.current_page
      if (meta.to > meta.total) {
        meta.to = meta.total
      }

      // Запрос 2 - сами данные
      let data
      if (find) {
        // Выборка окончательная
        SQL = `SELECT
          ${fieldList}
          FROM ${dataSource}
          ${whereExpression}
          ${sortExpression}
        `
        let all = await this.selectAll(SQL)
        all.every((row, i) => {
          let key = this.model.primaryKey
          if (String(row[key]) === String(find)) {
            meta.current_page = Math.ceil((i + 1) / meta.per_page)
            meta.from = meta.per_page * (meta.current_page - 1) + 1
            meta.to = meta.per_page * meta.current_page
            if (meta.to > meta.total) {
              meta.to = meta.total
            }
            return false
          } else {
            return true
          }
        })
        data = all.slice(meta.from - 1, meta.to)
      } else {
        let limitExpression =
          `limit ${meta.from - 1}, ${meta.per_page}`

        // Выборка окончательная
        SQL = `SELECT
          ${fieldList}
          FROM ${dataSource}
          ${whereExpression}
          ${sortExpression}
          ${limitExpression}
        `
        data = await this.selectAll(SQL)
      }

      if (this.config.tree) {
        let childrenCount = this.config.childrenCount || 'children_count'
        const stats = await this.getCache()
        data = data.map(e => {
          e[childrenCount] = stats[e[this.model.primaryKey]]
          return e
        })
      }

      if (this.config.onTransformPage) {
        data = await this.config.onTransformPage(data, this)
      }
      let dataPage = data
        .map(e => {
          if (search) {
            searchable.forEach(col => {
              if (this.config.highlightClass) {
                e[col] = RestController.highlightClass(e[col], search, this.config.highlightClass)
              } else if (this.config.highlightColor) {
                e[col] = RestController.highlightColor(e[col], search, this.config.highlightColor)
              }
            })
          }
          if (this.config.onTransformRow) {
            let returned = this.config.onTransformRow(e, this)
            if (returned) {
              return returned
            }
          }
          return e
        })
        .filter(e => Boolean(e))

      return Response.list(response, dataPage, meta)
    } catch (error) {
        Logger.error(error, SQL)
        return Response.genericError(response, error.message, 500)
    }
  }

  async show(id, request, response) {
    try {
      let data = await this.model.find(id)
      if (data) {
        if (this.config.tree) {
          let childrenCount = this.config.childrenCount || 'children_count'
          const stats = await this.getCache()
          data[childrenCount] = stats[data[this.model.primaryKey]]
        }
        data = data.toJSON()
        if (this.config.onShow) {
          let returned = await this.config.onShow(data, this)
          if (returned) {
            data = returned
          }
        }
        return Response.show(response, data)
      } else {
        return Response.notFound(response)
      }
    } catch (error) {
      Logger.error(error)
      return Response.genericError(response, error.message, 500)
    }
  }

  async store (data, request, response) {
    let fields = Object.keys(data)
    let original = {}
    fields.forEach(field => {
      original[field] = null
    })
    if (this.config.onBeforeStore) {
      let returned = await this.config.onBeforeStore(data, this)
      if (returned) {
        data = returned
      }
    }
    if (this.config.onBeforeAnySave) {
      let returned = await this.config.onBeforeAnySave(data, original, this)
      if (returned) {
        data = returned
      }
    }
    let record = new this.model()
    record.merge(data)
    try {
      await record.save()
    } catch (e) {
      return Response.validationFailed(response, record.errors, e.message)
    }

    if (this.config.onAfterStore) {
      await this.config.onAfterStore(data, this, record)
    }
    if (this.config.onAfterAnySave) {
      await this.config.onAfterAnySave(data, original, this, record, request)
    }
    if (this.usingCache) {
      await this.clearCache()
    }
    return Response.created(response, record, _.get(this.config, 'createdMessage'))
  }

  async update (id, data, request, response) {
    let record = await this.model.find(request.params.id)
    if (record) {
      let fields = Object.keys(data)
      let original = {}
      fields.forEach(field => {
        original[field] = record[field]
      })
      if (this.config.onBeforeUpdate) {
        let returned = await this.config.onBeforeUpdate(data, original, this)
        if (returned) {
          data = returned
        }
      }
      if (this.config.onBeforeAnySave) {
        let returned = await this.config.onBeforeAnySave(data, original, this)
        if (returned) {
          data = returned
        }
      }
      record.merge(data)
      try {
        await record.save()
      } catch (e) {
        return Response.validationFailed(response, record.errors, e.message)
      }

      if (this.config.onAfterUpdate) {
        await this.config.onAfterUpdate(data, original, this, record)
      }
      if (this.config.onAfterAnySave) {
        await this.config.onAfterAnySave(data, original, this, record, request)
      }
      if (this.usingCache) {
        await this.clearCache()
      }

      return Response.updated(response, record, _.get(this.config, 'updatedMessage'))
    } else {
      return Response.notFound(response)
    }
  }

  async destroy (id, request, response) {
    try {
      let record = await this.model.find(id)
      if (record) {
        if (this.config.onBeforeDelete) {
          await this.config.onBeforeDelete(record, this)
        }
        if (typeof record.onBeforeDelete === 'function') {
          await record.onBeforeDelete(record, this, request)
        }
        if (this.config.softDeletes) {
          record.deleted_at = moment().format('YYYY-MM-DD HH:mm:ss')
          await record.save()
        } else {
          await record.delete()
        }
        if (this.config.onAfterDelete) {
          await this.config.onAfterDelete(record, this)
        }
        if (this.usingCache) {
          await this.clearCache()
        }
        return Response.deleted(response, _.get(this.config, 'deletedMessage'))
      } else {
        return Response.notFound(response)
      }
    } catch (error) {
      Logger.error(error)
      return Response.genericError(response, error.message, 500)
    }
  }

  async sort(id, request, response)
  {
    let primaryKey = this.model.primaryKey
    let posKey = this.config.orderColumn || 'pos'
    let table = this.model.table
    let condition = this.config.softDeletes ? 'and deleted_at is null' : ''
    let order = request.input('order')
    if (Array.isArray(order)) {
      order.forEach((id, index) => {
        this.query(`
          update ${table}
            set
            ${posKey}=${index},
            updated_at=now()
          where ${primaryKey}=${id} and ${posKey}<>${index} ${condition}
        `)
      })
    }
    if (this.usingCache) {
      await this.clearCache()
    }
    return Response.genericMessage(response, 'Сортировка обновлена')
  }


  async path(id, request, response)
  {
    let primaryKey = this.model.primaryKey
    let parents = await this.getParents(id)
    return Response.genericData(response, parents.map(e => e[primaryKey]))
  }

  async getParents(id) {
    let primaryKey = this.model.primaryKey
    let parentKey = this.config.parent || 'parent'
    let table = this.model.table
    let condition = this.config.softDeletes ? 'and deleted_at is null' : ''
    let current = id
    let cnt = 0
    let parts = []
    while (current) {
      let row = await this.selectRow(`select * from
        ${table} where ${primaryKey}=${current} ${condition}`)
      if (row) {
        parts.push(row)
        current = row[parentKey]
      } else {
        break
      }
      cnt++
      if (cnt > 20) {
        break
      }
    }
    return parts.reverse()
  }

  async getLastPosition(parentId) {
    let posKey = this.config.orderColumn || 'pos'
    let parentKey = this.config.parent || 'parent'
    let table = this.model.table
    let condition = this.config.softDeletes ? 'and deleted_at is null' : ''
    let position = await this.selectField(`select max(${posKey}) from
      ${table} where ${parentKey}=${parentId} ${condition}`)
    if (typeof position === 'number') {
      return position + 1
    } else {
      return 0
    }
  }

  async clearCache() {
    if (this.config.onClearCache) {
      await this.config.onClearCache(Cache, this)
    }
    await Cache.pull(this.model.table + '-tree-stats') // Clear cached stats
  }

  async getCache() {

    let table = this.model.table
    let parent = this.config.parent || 'parent'
    let condition = this.config.softDeletes ? 'where deleted_at is null' : ''
    return await Cache.get(table + '-tree-stats', async () => {

      if (this.config.onBuildCache) {
        await this.config.onBuildCache(Cache, this)
      }

      let buffer = await this.selectAll(`
        select ${parent} as parent, count(*) as count
        from ${table} ${condition}
        group by ${parent}`)
      let stats = {}
      buffer.forEach(e => {
        stats[e.parent] = e.count
      })
      return stats
    })
  }
  static highlightClass(text, search, hlClass) {
    return String(text || '').replace(new RegExp(search, 'ig'), `<span class="${hlClass}">$&</span>`)
  }
  static highlightColor(text, search, hlColor) {
    return String(text || '').replace(new RegExp(search, 'ig'), `<span color="${hlColor}">$&</span>`)
  }
}
module.exports = RestController

