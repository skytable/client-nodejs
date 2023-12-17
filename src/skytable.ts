import {Socket} from "node:net"
import {TLSSocket} from "node:tls"
import {connectionWrite} from "./connection"
import {encodeParams, formatResponse} from "./protocol"
import {SQParam} from "@types/skytable"

export function createSkytable(connection: Socket | TLSSocket) {

  const query = async (query: string, ...params: SQParam[]) => {
    try {
      const dataframe = `${query}${encodeParams(params)}`
      const data = [query.length, '\n', dataframe]
      const requestData = ['S', data.join('').length, '\n', ...data]
      const buffer = Buffer.from(requestData.join(''), 'utf-8')

      console.log([requestData.join('')], '=========query============')
      const res = await connectionWrite(connection, buffer)

      return formatResponse(res)
    } catch (e) {
      console.error(e)
    }
  }

  return {
    query
  }
}
