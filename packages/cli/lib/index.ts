import cac from 'cac'
import JoyCon from 'joycon'
import fs from 'fs-extra'
import { BabelParserPlugins } from '@vuese/parser'
import Log from 'log-horizon'
import preview from './preview'
import genDocute from './genDocute'
import genMarkdown from './genMarkdown'
import server from './server'

// Gotta fix after https://github.com/tabrindle/envinfo/pull/105 gets merged (type-definitions)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const envinfo = require('envinfo')

const logger = Log.create()
const cli = cac()
const joycon = new JoyCon({
  packageKey: 'vuese'
})
joycon.addLoader({
  test: /\.vueserc$/,
  async load(filePath: string) {
    const source = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(source)
  }
})

export type CliOptions = {
  include: string | string[]
  exclude: string | string[]
  outDir: string
  markdownDir: string
  markdownFile: string
  genType: 'docute' | 'markdown'
  title: string
  babelParserPlugins: BabelParserPlugins
  isPreview: boolean
  open: boolean
  port: number
  host: string
  keepFolderStructure: boolean
  docuteOptions: object
}
type PartialCliOptions = Partial<CliOptions>

async function getConfig(
  flags: PartialCliOptions
): Promise<Partial<CliOptions>> {
  const { path, data } = await joycon.load([
    'vuese.config.js',
    '.vueserc',
    'package.json'
  ])
  const config: PartialCliOptions = {
    genType: 'docute',
    title: 'Components',
    include: '**/*.vue',
    exclude: [],
    outDir: 'website',
    markdownDir: 'components',
    markdownFile: '',
    host: '127.0.0.1',
    keepFolderStructure: false
  }
  if (path) Object.assign(config, data, flags)
  Object.assign(config, flags || {})
  return config
}

cli.command('').action(() => {
  cli.outputHelp()
})

cli
  .command('preview [file]', 'Preview a vue component as a document')
  .example('vuese preview path-to-the-component.vue')
  .action(async (file: string, flags: Partial<CliOptions>) => {
    if (!file) {
      logger.error('Missing component path.')
      cli.outputHelp()
    }
    const config = await getConfig(flags)
    config.include = file
    config.isPreview = true
    preview(config as CliOptions)
  })

cli
  .command('gen', 'Generate target resources')
  .option('-k, --keepFolderStructure', 'keep original folder structure')
  .allowUnknownOptions()
  .action(async (flags: Partial<CliOptions>) => {
    const config = await getConfig(flags)
    if (!['docute', 'markdown'].includes(config.genType as string)) {
      logger.error(`Please provide the correct genType: ${config.genType}`)
    }
    if (config.genType === 'docute') genDocute(config as CliOptions)
    else if (config.genType === 'markdown') genMarkdown(config as CliOptions)
  })

cli
  .command('serve', 'Serve generated docute website')
  .option('--open', 'Open the browser automatically')
  .option('--host [host]', 'Host name')
  .option('--port [port]', 'The port number')
  .allowUnknownOptions()
  .action(async (flags: PartialCliOptions) => {
    const config = await getConfig(flags)
    server(config as CliOptions)
  })

cli
  .command(
    'info',
    'Show debugging information concerning the local environment'
  )
  .action(async () => {
    logger.log('\nEnvironment Info:')
    const data = await envinfo.run({
      System: ['OS', 'CPU'],
      Binaries: ['Node', 'Yarn', 'npm'],
      Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
      npmGlobalPackages: ['vuese']
    })
    logger.log(data)
  })

cli.version(require('../package.json').version)
cli.help()

cli.parse()
