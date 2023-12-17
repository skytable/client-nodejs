import {createQuery, SQParam} from "./Query"
import {Socket} from "node:net"
import {TLSSocket} from "node:tls"
import {connectionWrite} from "./connection"

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
        return [0x06, param.length, '\n', param].join('')
      case 'number':
        // 2 Unsigned integer 64
        // 3 Signed integer 64
        // 4 Float A 64-bit
        return [isFloat(param) ? 0x04 : 0x03, Number(param), '\n'].join('')
      case 'bigint':
        return [0x02, Number(param), '\n'].join('')
      // TODO 5 A binary blob [5<size>\n<payload>]
      case 'boolean':
        return [0x01, Number(param)].join('')
      default:
        // null undefined
        if (param == null) {
          return 0
        }
        throw new TypeError(`un support type: ${typeof param}, val: ${param}`)
    }
  }).join('')
}

const Responses = {
  Error: 0x10,
  Row: 0x11,
  Empty: 0x12,
  Multirow: 0x13,
}

export function formatResponse(res) {
  const array = Array.from(res);
  const [type, ...dataArray] = array;

  // TODO Format all
  console.log(array)
  switch (type) {
    case Responses.Empty:
      return { success: true, data: [] }
    case Responses.Row:
      return { success: true, data: dataArray }
    case Responses.Multirow:
      return { success: true, data: dataArray }
    case Responses.Error:
      return { success: false, data: [], message: 'error code ' + dataArray[0] }
    default:
      throw new TypeError('unknown response type')
  }
}

export function createSkytable(connection: Socket | TLSSocket) {

  const query = async (query: string, ...params: SQParam[]) => {
    const queryInstance = createQuery(query, ...params)

    // const metaframe =
    // <query body size>\n
    const dataframe = `${query}${encodeParams(params)}`

    let buf = [query.length, '\n', dataframe]

    buf = ['S', buf.join('').length, '\n', ...buf]

    console.log([buf.join('').split('')], buf.join('').length, '=====query======')

    const res = await connectionWrite(connection, Buffer.from(buf.join(''), 'utf-8'))
    console.log(formatResponse(res), '===========result==========');
  }

  return {
    query
  }
}
