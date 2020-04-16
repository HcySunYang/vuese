import traverse, { NodePath } from '@babel/traverse'
import * as bt from '@babel/types'
import { getComments, CommentResult, getComponentDescribe } from './jscomments'
import {
  PropsResult,
  ParserOptions,
  EventResult,
  MethodResult,
  ComputedResult,
  DataResult,
  MixInResult,
  SlotResult,
  WatchResult
} from '@vuese/parser'
import { getValueFromGenerate, isVueOption, computesFromStore } from './helper'
import {
  processPropValue,
  normalizeProps,
  getPropDecorator,
  getArgumentFromPropDecorator
} from './processProps'
import { processDataValue } from './processData'
import { processEventName, getEmitDecorator } from './processEvents'
import { determineChildren } from './processRenderFunction'
import { Seen } from './seen'

export function parseJavascript(
  ast: bt.File,
  seenEvent: Seen,
  options: ParserOptions,
  source: string = ''
) {
  // backward compatibility
  const seenSlot = new Seen()
  traverse(ast, {
    ExportDefaultDeclaration(rootPath: NodePath<bt.ExportDefaultDeclaration>) {
      // Get a description of the component
      if (options.onDesc) options.onDesc(getComponentDescribe(rootPath.node))

      rootPath.traverse({
        ObjectProperty(path: NodePath<bt.ObjectProperty>) {
          const {
            onProp,
            onMethod,
            onComputed,
            onName,
            onSlot,
            onMixIn,
            onData,
            onWatch
          } = options
          // Processing name
          if (isVueOption(path, 'name')) {
            let componentName = (path.node.value as bt.StringLiteral).value
            if (onName) onName(componentName)
          }

          // Processing props
          if (onProp && isVueOption(path, 'props')) {
            const valuePath = path.get('value')

            if (bt.isArrayExpression(valuePath.node)) {
              // An array of strings
              const propsValue: [] = getValueFromGenerate(valuePath.node)
              const propsRes: PropsResult[] = normalizeProps(propsValue)
              propsRes.forEach(prop => {
                if (onProp) onProp(prop)
              })
            } else if (bt.isObjectExpression(valuePath.node)) {
              // An object
              valuePath.traverse({
                ObjectProperty(propPath: NodePath<bt.ObjectProperty>) {
                  // Guarantee that this is the prop definition
                  if (propPath.parentPath === valuePath) {
                    const name = bt.isIdentifier(propPath.node.key)
                      ? propPath.node.key.name
                      : propPath.node.key.value
                    const propValueNode = propPath.node.value
                    const result: PropsResult = {
                      name,
                      type: null,
                      describe: getComments(propPath.node).default
                    }

                    processPropValue(propValueNode, result, source)

                    onProp(result)
                  }
                }
              })
            }
          }

          // Processing mixins
          if (onMixIn && isVueOption(path, 'mixins')) {
            const properties = (path.node.value as bt.ArrayExpression).elements

            properties.forEach(mixIn => {
              const result: MixInResult = {
                mixIn: (mixIn as bt.Identifier).name
              }
              onMixIn(result)
            })
          }

          // Processing computed
          if (
            onComputed &&
            isVueOption(path, 'computed') &&
            bt.isObjectExpression(path.node.value)
          ) {
            const properties = (path.node
              .value as bt.ObjectExpression).properties.filter(
              n => bt.isObjectMethod(n) || bt.isObjectProperty(n)
            ) as (bt.ObjectMethod | bt.ObjectProperty)[]

            properties.forEach(node => {
              const commentsRes: CommentResult = getComments(node)
              const isFromStore: boolean = computesFromStore(node)

              // Collect only computed that have @vuese annotations
              if (commentsRes.vuese) {
                const result: ComputedResult = {
                  name: node.key.name,
                  type: commentsRes.type,
                  describe: commentsRes.default,
                  isFromStore: isFromStore
                }
                onComputed(result)
              }
            })
          }

          if (
            onData &&
            isVueOption(path, 'data') &&
            (bt.isObjectExpression(path.node.value) ||
              bt.isArrowFunctionExpression(path.node.value))
          ) {
            const value = bt.isArrowFunctionExpression(path.node.value)
              ? path.node.value.body
              : path.node.value
            const properties = (value as bt.ObjectExpression).properties.filter(
              n => bt.isObjectMethod(n) || bt.isObjectProperty(n)
            ) as bt.ObjectProperty[]

            properties.forEach(node => {
              const commentsRes: CommentResult = getComments(node)
              // Collect only data that have @vuese annotations
              if (commentsRes.vuese) {
                const result: DataResult = {
                  name: node.key.name,
                  type: '',
                  describe: commentsRes.default,
                  default: ''
                }
                processDataValue(node, result)
                onData(result)
              }
            })
          }

          // Processing methods
          if (onMethod && isVueOption(path, 'methods')) {
            const properties = (path.node
              .value as bt.ObjectExpression).properties.filter(
              n => bt.isObjectMethod(n) || bt.isObjectProperty(n)
            ) as (bt.ObjectMethod | bt.ObjectProperty)[]

            properties.forEach(node => {
              const commentsRes: CommentResult = getComments(node)
              // Collect only methods that have @vuese annotations
              if (commentsRes.vuese) {
                const result: MethodResult = {
                  name: node.key.name,
                  describe: commentsRes.default,
                  argumentsDesc: commentsRes.arg
                }
                onMethod(result)
              }
            })
          }

          // Processing watch
          if (
            onWatch &&
            isVueOption(path, 'watch') &&
            bt.isObjectExpression(path.node.value)
          ) {
            const properties = (path.node
              .value as bt.ObjectExpression).properties.filter(
              n => bt.isObjectMethod(n) || bt.isObjectProperty(n)
            ) as (bt.ObjectMethod | bt.ObjectProperty)[]

            properties.forEach(node => {
              const commentsRes: CommentResult = getComments(node)
              // Collect only data that have @vuese annotations
              if (commentsRes.vuese) {
                const result: WatchResult = {
                  name: node.key.name,
                  describe: commentsRes.default,
                  argumentsDesc: commentsRes.arg
                }
                onWatch(result)
              }
            })
          }

          // functional component - `ctx.children` in the render function
          if (
            onSlot &&
            isVueOption(path, 'render') &&
            !seenSlot.seen('default')
          ) {
            const functionPath = path.get('value')
            determineChildren(functionPath, onSlot)
          }
        },
        ObjectMethod(path: NodePath<bt.ObjectMethod>) {
          const { onData } = options
          // @Component: functional component - `ctx.children` in the render function
          if (
            options.onSlot &&
            isVueOption(path, 'render') &&
            !seenSlot.seen('default')
          ) {
            determineChildren(path, options.onSlot)
          }

          // Data can be represented as a component or a method
          if (onData && isVueOption(path, 'data')) {
            path.node.body.body.forEach(body => {
              if (bt.isReturnStatement(body)) {
                const properties = (body.argument as bt.ObjectExpression).properties.filter(
                  n => bt.isObjectMethod(n) || bt.isObjectProperty(n)
                ) as bt.ObjectProperty[]

                properties.forEach(node => {
                  const commentsRes: CommentResult = getComments(node)
                  // Collect only data that have @vuese annotations
                  if (commentsRes.vuese) {
                    const result: DataResult = {
                      name: node.key.name,
                      type: '',
                      describe: commentsRes.default,
                      default: ''
                    }
                    processDataValue(node, result)
                    onData(result)
                  }
                })
              }
            })
          }
        },
        CallExpression(path: NodePath<bt.CallExpression>) {
          const node = path.node
          let parentExpressionStatementNode = path.findParent(path =>
            bt.isExpressionStatement(path)
          )
          // $emit()
          if (
            bt.isMemberExpression(node.callee) &&
            bt.isIdentifier(node.callee.property) &&
            node.callee.property.name === '$emit' &&
            bt.isExpressionStatement(parentExpressionStatementNode)
          ) {
            processEmitCallExpression(
              path,
              seenEvent,
              options,
              parentExpressionStatementNode
            )
          } else if (
            options.onSlot &&
            bt.isMemberExpression(node.callee) &&
            bt.isMemberExpression(node.callee.object) &&
            bt.isIdentifier(node.callee.object.property) &&
            node.callee.object.property.name === '$scopedSlots'
          ) {
            // scopedSlots
            let slotsComments: CommentResult
            if (bt.isExpressionStatement(path.parentPath)) {
              slotsComments = getComments(path.parentPath.node)
            } else {
              slotsComments = getComments(node)
            }
            const scopedSlots: SlotResult = {
              name: node.callee.property.name,
              describe: slotsComments.default.join(''),
              backerDesc: slotsComments.content
                ? slotsComments.content.join('')
                : '',
              bindings: {},
              scoped: true,
              target: 'script'
            }

            options.onSlot(scopedSlots)
          }
        },
        // Class style component
        ClassProperty(path: NodePath<bt.ClassProperty>) {
          const propDeco = getPropDecorator(path.node)
          if (propDeco) {
            let typeAnnotationStart = 0
            let typeAnnotationEnd = 0
            /**
             * if ClassProperty like this
             *` b: number | string`
             *  if classProperty has typeAnnotation just use it as its type, unless it has decorator
             */
            if (
              path.node.typeAnnotation &&
              bt.isTSTypeAnnotation(path.node.typeAnnotation)
            ) {
              let { start, end } = path.node.typeAnnotation.typeAnnotation
              typeAnnotationStart = start || 0
              typeAnnotationEnd = end || 0
            }
            const result: PropsResult = {
              name: (path.node.key as bt.Identifier).name,
              //null for backward compatibility,
              type:
                source.slice(typeAnnotationStart, typeAnnotationEnd) || null,
              describe: getComments(path.node).default
            }
            const propDecoratorArg = getArgumentFromPropDecorator(propDeco)
            if (propDecoratorArg) {
              processPropValue(propDecoratorArg, result, source)
            }

            if (options.onProp) options.onProp(result)
          }
        },
        ClassMethod(path: NodePath<bt.ClassMethod>) {
          const node = path.node
          const commentsRes: CommentResult = getComments(node)
          // Collect only methods that have @vuese annotations
          if (commentsRes.vuese) {
            const result: MethodResult = {
              name: (node.key as bt.Identifier).name,
              describe: commentsRes.default,
              argumentsDesc: commentsRes.arg
            }
            if (options.onMethod) options.onMethod(result)
          }

          // Ctx.children in the render function of the Class style component
          if (
            options.onSlot &&
            bt.isIdentifier(node.key) &&
            node.key.name === 'render' &&
            !seenSlot.seen('default')
          ) {
            determineChildren(path, options.onSlot)
          }

          // @Emit
          const emitDecorator = getEmitDecorator(node.decorators)
          if (emitDecorator) {
            const result: EventResult = {
              name: '',
              isSync: false,
              syncProp: ''
            }
            const args = (emitDecorator.expression as bt.CallExpression)
              .arguments
            if (args && args.length && bt.isStringLiteral(args[0])) {
              result.name = (args[0] as bt.StringLiteral).value
            } else {
              if (bt.isIdentifier(node.key)) {
                result.name = node.key.name
                  .replace(/([A-Z])/g, '-$1')
                  .toLowerCase()
              }
            }
            if (!result.name || seenEvent.seen(result.name)) return

            processEventName(result.name, path, result)
            // trigger onEvent if options has an onEvent callback function and
            // if excludeSyncEvent, should `result.isSync` be true, otherwise just call the callback
            if (
              options.onEvent &&
              (!!options.includeSyncEvent || !result.isSync)
            ) {
              options.onEvent(result)
            }
          }
        },
        MemberExpression(path: NodePath<bt.MemberExpression>) {
          const node = path.node
          const parentNode = path.parentPath.node
          const grandPath = path.parentPath.parentPath

          if (
            options.onSlot &&
            bt.isIdentifier(node.property) &&
            node.property.name === '$slots' &&
            grandPath
          ) {
            let slotName = ''
            let slotsComments: CommentResult = {
              default: []
            }
            if (
              bt.isMemberExpression(parentNode) &&
              bt.isIdentifier(parentNode.property)
            ) {
              // (this || vm).$slots.xxx
              slotName = parentNode.property.name
              slotsComments = bt.isExpressionStatement(grandPath.node)
                ? getComments(grandPath.node)
                : getComments(parentNode)
            } else if (
              bt.isCallExpression(parentNode) &&
              bt.isMemberExpression(grandPath.node) &&
              bt.isIdentifier(grandPath.node.property)
            ) {
              // ctx.$slots().xxx
              slotName = grandPath.node.property.name
              const superNode = grandPath.parentPath.node
              slotsComments = bt.isExpressionStatement(superNode)
                ? getComments(superNode)
                : getComments(grandPath.node)
            }

            // Avoid collecting the same slot multiple times
            if (!slotName || seenSlot.seen(slotName)) return

            const slotRes: SlotResult = {
              name: slotName,
              describe: slotsComments.default.join(''),
              backerDesc: slotsComments.content
                ? slotsComments.content.join('')
                : '',
              bindings: {},
              scoped: false,
              target: 'script'
            }

            options.onSlot(slotRes)
          }
        }
      })
    }
  })
}

export function processEmitCallExpression(
  path: NodePath<bt.CallExpression>,
  seenEvent: Seen,
  options: ParserOptions,
  parentExpressionStatementNodePath: NodePath<bt.Node>
) {
  const node = path.node
  const { onEvent, includeSyncEvent } = options
  const args = node.arguments
  const result: EventResult = {
    name: '',
    isSync: false,
    syncProp: ''
  }
  const firstArg = args[0]
  if (firstArg) {
    if (bt.isStringLiteral(firstArg)) {
      result.name = firstArg.value
    } else {
      if (bt.isIdentifier(firstArg)) {
        result.name = '`' + firstArg.name + '`'
      }
    }
  }

  if (!result.name || seenEvent.seen(result.name)) return

  processEventName(result.name, parentExpressionStatementNodePath, result)

  if (onEvent && (!!includeSyncEvent || !result.isSync)) {
    onEvent(result)
  }
}
