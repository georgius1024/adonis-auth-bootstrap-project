'use strict'
const Logger = use('Logger')
const Response = use('App/Lib/Response')
const BaseExceptionHandler = use('BaseExceptionHandler')
/**
 * This class handles all exceptions thrown during
 * the HTTP request lifecycle.
 *
 * @class ExceptionHandler
 */
class ExceptionHandler extends BaseExceptionHandler {
  /**
   * Handle exception thrown during the HTTP lifecycle
   *
   * @method handle
   *
   * @param  {Object} error
   * @param  {Object} options.request
   * @param  {Object} options.response
   *
   * @return {void}
   */
  async handle (error, { request, response }) {
    Logger.error(error.name, error.message, error.status)
    console.log(error)
    if (/E_JWT_TOKEN_EXPIRED/.test(error.message)) {
      return Response.genericError(response, 'Истек срок действия ссылки. Перелогиньтесь, пожалуйста', error.status)
    } else {
      return Response.genericError(response, error.message, error.status)
    }
  }

  /**
   * Report exception for logging or debugging.
   *
   * @method report
   *
   * @param  {Object} error
   * @param  {Object} options.request
   *
   * @return {void}
   */
  async report (error, { request }) {
  }
}

module.exports = ExceptionHandler
