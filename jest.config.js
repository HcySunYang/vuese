/**@type{import("ts-jest")} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: '(/__test__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@vuese/(.*?)$': '<rootDir>/packages/$1/lib'
  },
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  }
}
