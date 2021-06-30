import { ParserResult } from '@vuese/parser'

export default function(parserRes: ParserResult): string {
  const desc = parserRes.componentDesc
  let templateStr = '# [name]\n\n'

  if (desc && desc.default.length) {
    templateStr += `${desc.default.join(' ')}\n\n`
  }
  const forceGenerate = desc && desc.vuese && parserRes.name
  const original = templateStr

  templateStr += parserRes.props ? genBaseTemplate('props') : ''
  templateStr += parserRes.events ? genBaseTemplate('events') : ''
  templateStr += parserRes.slots ? genBaseTemplate('slots') : ''
  templateStr += parserRes.methods ? genBaseTemplate('methods') : ''
  templateStr += parserRes.computed ? genBaseTemplate('computed') : ''
  templateStr += parserRes.mixIns ? genBaseTemplate('mixIns') : ''
  templateStr += parserRes.data ? genBaseTemplate('data') : ''
  templateStr += parserRes.watch ? genBaseTemplate('watch') : ''
  templateStr += parserRes.extraDocs ? parserRes.extraDocs : ''

  return !forceGenerate && original === templateStr ? '' : templateStr
}

function genBaseTemplate(label: string): string {
  let str = `## ${upper(label)}\n\n`
  str += `<!-- @vuese:[name]:${label}:start -->\n\n`
  str += `<!-- @vuese:[name]:${label}:end -->\n\n`
  return str
}

function upper(word: string): string {
  return word[0].toUpperCase() + word.slice(1)
}
