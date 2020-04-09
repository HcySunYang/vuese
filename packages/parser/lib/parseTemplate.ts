import {
  ParserOptions,
  SlotResult,
  AttrsMap,
  processEmitCallExpression
} from '@vuese/parser'
import { parse as babelParse } from '@babel/parser'
import { Seen } from './seen'
import { File } from '@babel/types'
import traverse, { NodePath } from '@babel/traverse'
import * as bt from '@babel/types'

export function parseTemplate(
  templateAst: any,
  seenEvent: Seen,
  options: ParserOptions
) {
  const parent = templateAst.parent
  if (templateAst.attrsMap) {
    for (let [attr, value] of Object.entries(templateAst.attrsMap)) {
      if (
        (attr.startsWith('v-on:') || attr.startsWith('@')) &&
        /\$emit\(.*?\)/.test(value as string)
      ) {
        try {
          const astFile = babelParse(value as string)
          if (astFile && astFile.type === 'File') {
            parseExpression(astFile, seenEvent, options)
          }
        } catch (err) {
          console.error(err)
        }
      }
    }
  }
  if (templateAst.type === 1) {
    if (templateAst.tag === 'slot') {
      const slot: SlotResult = {
        name: 'default',
        describe: '',
        backerDesc: '',
        bindings: {},
        scoped: false,
        target: 'template'
      }
      slot.bindings = extractAndFilterAttr(templateAst.attrsMap)
      if (slot.bindings.name) {
        slot.name = slot.bindings.name
        delete slot.bindings.name
      }

      // scoped slot
      if (Object.keys(slot.bindings).length) slot.scoped = true

      if (parent) {
        const list: [] = parent.children
        let currentSlotIndex = 0
        for (let i = 0; i < list.length; i++) {
          let el = list[i]
          if (el === templateAst) {
            currentSlotIndex = i
            break
          }
        }

        // Find the first leading comment node as a description of the slot
        const copies = list.slice(0, currentSlotIndex).reverse()
        for (let i = 0; i < copies.length; i++) {
          let el: any = copies[i]
          if (el.type !== 3 || (!el.isComment && el.text.trim())) break
          if (
            el.isComment &&
            !(parent.tag === 'slot' && parent.children[0] === el)
          ) {
            slot.describe = el.text.trim()
            break
          }
        }

        // Find the first child comment node as a description of the default slot content
        if (templateAst.children.length) {
          for (let i = 0; i < templateAst.children.length; i++) {
            let el: any = templateAst.children[i]
            if (el.type !== 3 || (!el.isComment && el.text.trim())) break
            if (el.isComment) {
              slot.backerDesc = el.text.trim()
              break
            }
          }
        }
      }
      if (options.onSlot) options.onSlot(slot)
    }

    const parseChildren = (templateAst: any) => {
      for (let i = 0; i < templateAst.children.length; i++) {
        parseTemplate(templateAst.children[i], seenEvent, options)
      }
    }
    if (templateAst.if && templateAst.ifConditions) {
      // for if statement iterate through the branches
      templateAst.ifConditions.forEach((c: any) => {
        parseChildren(c.block)
      })
    } else {
      parseChildren(templateAst)
    }
  }
}

const dirRE = /^(v-|:|@)/
const allowRE = /^(v-bind|:)/
function extractAndFilterAttr(attrsMap: AttrsMap): AttrsMap {
  const res: AttrsMap = {}
  const keys = Object.keys(attrsMap)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (!dirRE.test(key) || allowRE.test(key)) {
      res[key.replace(allowRE, '')] = attrsMap[key]
    }
  }
  return res
}

function parseExpression(
  astFile: File,
  seenEvent: Seen,
  options: ParserOptions
) {
  traverse(astFile, {
    CallExpression(path: NodePath<bt.CallExpression>) {
      const node = path.node
      // $emit()
      if (
        bt.isIdentifier(node.callee) &&
        node.callee.name === '$emit' &&
        bt.isExpressionStatement(path.parentPath.node)
      ) {
        processEmitCallExpression(path, seenEvent, options)
      }
    }
  })
}
