/* eslint-disable @typescript-eslint/no-empty-function */
import * as path from 'path'
import * as fs from 'fs'
import {
  sfcToAST,
  parseTemplate,
  AstResult,
  SlotResult,
  ParserOptions
} from '@vuese/parser'
import { Seen } from '../lib/seen'

function getAST(fileName: string): AstResult {
  const p = path.resolve(__dirname, `./__fixtures__/${fileName}`)
  const source = fs.readFileSync(p, 'utf-8')
  return sfcToAST(source)
}

test('Default slot with slot description', () => {
  const sfc: AstResult = getAST('defaultSlot.vue')
  const options: ParserOptions = {
    onSlot: jest.fn(slotRes => {
      expect((slotRes as SlotResult).name).toBe('default')
      expect((slotRes as SlotResult).describe).toBe('default slot')
      expect((slotRes as SlotResult).backerDesc).toBe('Default Slot Content')
      expect((slotRes as SlotResult).bindings).toEqual({})
    })
  }
  const seen = new Seen()
  parseTemplate(sfc.templateAst, seen, options)
  expect(options.onSlot).toBeCalled()
})

test('Default slot with slot description in a v-if', () => {
  const sfc: AstResult = getAST('slotWithVif.vue')
  const options: ParserOptions = {
    onSlot: jest.fn(slotRes => {
      expect((slotRes as SlotResult).name).toBe('default')
    })
  }
  const seen = new Seen()
  parseTemplate(sfc.templateAst, seen, options)
  expect(options.onSlot).toBeCalled()
})

test('Named slot with slot description', () => {
  const sfc: AstResult = getAST('namedSlot.vue')
  const mockOnSlot = jest.fn(() => {})
  const options: ParserOptions = {
    onSlot: mockOnSlot
  }
  const seen = new Seen()
  parseTemplate(sfc.templateAst, seen, options)

  expect(mockOnSlot.mock.calls.length).toBe(1)
  const arg = mockOnSlot.mock.calls[0][0]
  expect((arg as SlotResult).name).toBe('header')
  expect((arg as SlotResult).describe).toBe('head slot')
  expect((arg as SlotResult).backerDesc).toBe('Default Slot Content')
  expect((arg as SlotResult).bindings).toEqual({})
})

test('Named slot with slot description and bingdings', () => {
  const sfc: AstResult = getAST('slotWithBindings.vue')
  const options: ParserOptions = {
    onSlot(slotRes) {
      expect((slotRes as SlotResult).name).toBe('header')
      expect((slotRes as SlotResult).describe).toBe('Named slot')
      expect((slotRes as SlotResult).backerDesc).toBe('Default Slot Content')
      expect((slotRes as SlotResult).bindings).toEqual({
        a: 'someData',
        b: 'str'
      })
    }
  }
  const seen = new Seen()
  parseTemplate(sfc.templateAst, seen, options)
})

test('slot inside Component with v-slot directive', () => {
  const sfc: AstResult = getAST('vslot.vue')
  const mockOnSlot = jest.fn(() => {})
  const options: ParserOptions = {
    onSlot: mockOnSlot
  }
  const seen = new Seen()
  parseTemplate(sfc.templateAst, seen, options)
  expect(mockOnSlot.mock.calls.length).toBe(2)
  const arg1 = mockOnSlot.mock.calls[0][0]
  const arg2 = mockOnSlot.mock.calls[1][0]

  expect(arg2).toEqual({
    name: 'header',
    describe: 'Some header',
    backerDesc: '',
    bindings: {},
    scoped: false,
    target: 'template'
  })

  expect(arg1).toEqual({
    name: 'searchSlot',
    describe: 'search slot',
    backerDesc: '',
    bindings: {},
    scoped: false,
    target: 'template'
  })
})

test('slot with @vuese-ignore tag', () => {
  const sfc: AstResult = getAST('slotIgnore.vue')
  const mockOnSlot = jest.fn(() => {})
  const options: ParserOptions = {
    onSlot: mockOnSlot
  }
  const seen = new Seen()

  parseTemplate(sfc.templateAst, seen, options)
  expect(mockOnSlot.mock.calls.length).toBe(0)
})
