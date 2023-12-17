import {Config} from "./Config"
import {SQParam} from "@types/skytable"

const RESPONSES_RESULT = {
  ERROR: 0x10,
  ROW: 0x11,
  EMPTY: 0x12,
  MULTIROW: 0x13,
}

const HANDSHAKE_RESULT = {
  SUCCESS: 'H00',
  ERROR: 'H01'
}

function isFloat(number) {
  return Number.isFinite(number) && !Number.isInteger(number)
}

export function encodeParams(parameters: SQParam[]): string {
  if (!parameters.length) {
    return ''
  }

  return parameters.map(param => {
    switch (typeof param) {
      case 'string':
        return ['\x06', param.length, '\n', param].join('')
      case 'number':
        // 2 Unsigned integer 64
        // 3 Signed integer 64
        // 4 Float A 64-bit
        return [isFloat(param) ? '\x04' : '\x03', Number(param), '\n'].join('')
      case 'bigint':
        return ['\x02', Number(param), '\n'].join('')
      // TODO 5 A binary blob [5<size>\n<payload>]
      case 'boolean':
        return ['\x01', Number(param) === 1 ? '\x01' : 0].join('')
      default:
        // null undefined
        if (param == null) {
          return 0
        }
        throw new TypeError(`un support type: ${typeof param}, val: ${param}`)
    }
  }).join('')
}

export function decodeColumn(count, dataType: string) {
  // TODO decode
}

export function formatRow(arr: number[]) {
  const [columnCount, ...dataType] = Buffer.from(arr).toString('utf-8').split('\n')
  const data = dataType.join('\n')

  return decodeColumn(columnCount, data);
}

export function formatRows(arr: number[]) {
  return arr;
}

export function formatResponse(res: Buffer) {
  const array = Array.from(res)
  const [type, ...dataArray] = array

  const errorCode = dataArray[0];

  // TODO Format all
  console.log(`error code ${errorCode || ''}`)
  switch (type) {
    case RESPONSES_RESULT.EMPTY:
      return {success: true, data: []}
    case RESPONSES_RESULT.ROW:
      return {success: true, data: formatRow(dataArray)}
    case RESPONSES_RESULT.MULTIROW:
      return {success: true, data: formatRows(dataArray)}
    case RESPONSES_RESULT.ERROR:
      return {success: false, data: [], message: 'error code ' + errorCode}
    default:
      throw new TypeError('unknown response type')
  }
}


export function getClientHandshake(config: Config): string {
  const username = config.getUsername()
  const password = config.getPassword()

  return [
    'H\x00\x00\x00\x00\x00',
    username.length,
    '\n',
    password.length,
    '\n',
    username,
    password
  ].join('')
}


export function bufferToHandshakeResult(buffer: Buffer): Promise<undefined> {

  return new Promise((resolve, reject) => {
    const [h, c1, c2, msg] = Array.from(buffer.toJSON().data)
    const code = [String.fromCharCode(h), c1, c2].join('');

    if (code === HANDSHAKE_RESULT.SUCCESS) {
      return resolve()
    }

    reject(new Error(`handshake error code ${code}, msg: ${msg}`));
  })
}
