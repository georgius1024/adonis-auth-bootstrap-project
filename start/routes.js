'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.0/routing
|
*/

const Route = use('Route')

Route.get('/', ({ request }) => {
  return { greeting: 'Hello world in JSON' }
})


// Ссылки для вставки в письма (нет префикса, нет авторизации)
Route
  .group(() => {
    Route.get('mail/activate/:code', 'AuthController.mailActivate')
    Route.get('mail/reset/:code', 'AuthController.mailResetPassword')
  })

// Вызовы API, не требующие авторизации
Route
  .group(() => {
    Route.post('register', 'AuthController.register')
    Route.post('login-traditional', 'AuthController.loginTraditional')
    Route.post('login-passwordless', 'AuthController.loginPasswordless')
    Route.post('once/:code', 'AuthController.loginOnce')
    Route.post('forgot/:email', 'AuthController.forgotPassword')
  })
  .prefix('api/v1')

// Вызов API, позволяющий работать в состоянии RESET
Route
  .group(() => {
    Route.post('resetpass', 'AuthController.resetPassword')
  })
  .prefix('api/v1')
  .middleware(['auth'])


// Вызовы API, требующие любой авторизации пользователя/админа
Route
  .group(() => {
    Route.get('user-profile', 'AuthController.showProfile')
    Route.post('user-profile', 'AuthController.updateProfile')
    Route.post('user-change-pass', 'AuthController.changePassword')

  })
  .prefix('api/v1')
  .middleware(['auth'])


// Вызовы API, требующие авторизации пользователя
Route
  .group(() => {
    Route.get('user-profile', 'AuthController.showProfile')
    Route.post('user-profile', 'AuthController.updateProfile')
    Route.post('user-change-pass', 'AuthController.changePassword')

  })
  .prefix('api/v1')
  .middleware(['auth', 'user'])

// Вызовы API, требующие авторизации админа
Route
  .group(() => {
    Route.resource('user', 'UserController')
  })
  .prefix('api/v1')
  .middleware(['auth', 'admin'])
