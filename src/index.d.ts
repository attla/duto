/// <reference types='bun-types' />
/// <reference types='node' />

// export { }

import * as Duto from './'

declare global {
  // Duto
  var __st: number
  var __hmr: boolean

  type Req = Duto.Req
  type Res = Duto.Res
  type $v = Duto.$v
  type IRequest = Duto.IRequest
  type IResponse = Duto.IResponse
  type IValidator = Duto.IValidator

  type Context = Duto.Context
  type Next = Duto.Next

  type Abilities = Duto.Abilities
  type Roles = Duto.Roles

  type EnumStatic = Duto.EnumStatic
  type EnumValue = Duto.EnumValue
  type EnumType = Duto.EnumType


  // Bun:test
  var test: typeof import('bun:test').test
  var describe: typeof import('bun:test').describe
  var it: typeof import('bun:test').it
  var expect: typeof import('bun:test').expect
  // Hooks
  var beforeAll: typeof import('bun:test').beforeAll
  var afterAll: typeof import('bun:test').afterAll
  var beforeEach: typeof import('bun:test').beforeEach
  var afterEach: typeof import('bun:test').afterEach
  // Mocking
  var mock: typeof import('bun:test').mock
  var vi: typeof import('bun:test').vi
  var jest: typeof import('bun:test').jest
  var spyOn: typeof import('bun:test').spyOn
  // Utils
  var setSystemTime: typeof import('bun:test').setSystemTime
  var setDefaultTimeout: typeof import('bun:test').setDefaultTimeout
  // Types
  var Test: typeof import('bun:test').Test
  var Describe: typeof import('bun:test').Describe
  var Expect: typeof import('bun:test').Expect
  var Mock: typeof import('bun:test').Mock
  var TestOptions: typeof import('bun:test').TestOptions
  var Matchers: typeof import('bun:test').Matchers
  // Namespace
  namespace jest {
    var fn: typeof import('bun:test').vi.fn
    var mock: typeof import('bun:test').vi.mock
  }
}
