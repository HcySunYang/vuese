import {
  ParserOptions,
  SlotResult,
  AttrsMap,
  processEmitCallExpression
} from '@vuese/parser'
import { parse as babelParse } from '@babel/parser'
import { Seen } from './seen'

import traverse, { NodePath } from '@babel/traverse'
import * as bt from '@babel/types'

export function parseTemplate(
  templateAst: any,
  seenEvent: Seen,
  options: ParserOptions
): void {
  const parent = templateAst.parent
  // parse event in template
  if (templateAst.attrsMap) {
    for (const [attr, value] of Object.entries(templateAst.attrsMap)) {
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

      let ignoreSlot = false

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
          const el = list[i]
          if (el === templateAst) {
            currentSlotIndex = i
            break
          }
        }

        // Find the first leading comment node as a description of the slot
        const copies = list.slice(0, currentSlotIndex).reverse()
        for (let i = 0; i < copies.length; i++) {
          const el: any = copies[i]
          if (el.type !== 3 || (!el.isComment && el.text.trim())) break
          if (
            el.isComment &&
            !(parent.tag === 'slot' && parent.children[0] === el)
          ) {
            const elText = el.text.trim()
            if (elText.startsWith('@vuese-ignore')) {
              ignoreSlot = true;
            }
            else {
              slot.describe = elText
            }
            break
          }
        }

        // Find the first child comment node as a description of the default slot content
        if (templateAst.children.length) {
          for (let i = 0; i < templateAst.children.length; i++) {
            const el: any = templateAst.children[i]
            if (el.type !== 3 || (!el.isComment && el.text.trim())) break
            if (el.isComment) {
              slot.backerDesc = el.text.trim()
              break
            }
          }
        }
      }
      if (options.onSlot && !ignoreSlot) options.onSlot(slot)
    }
    if (templateAst.scopedSlots) {
      Object.values(templateAst.scopedSlots).forEach(scopedSlot => {
        parseTemplate(scopedSlot, seenEvent, options)
      })
    }
    const parseChildren: (templateAst: any) => void = (templateAst: any) => {
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
  astFile: bt.File,
  seenEvent: Seen,
  options: ParserOptions
): void {
  traverse(astFile, {
    CallExpression(path: NodePath<bt.CallExpression>) {
      const node = path.node

      // $emit()
      if (bt.isIdentifier(node.callee) && node.callee.name === '$emit') {
        const parentExpressionStatementNodePath = path.findParent(path =>
          bt.isExpressionStatement(path)
        )
        if (bt.isExpressionStatement(parentExpressionStatementNodePath)) {
          processEmitCallExpression(
            path,
            seenEvent,
            options,
            parentExpressionStatementNodePath
          )
        }
      }
    }
  })
}
