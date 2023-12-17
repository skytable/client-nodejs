export class Query {
  private _query: string
  private _params: SQParam[]

  /**
   * Create a new query with the base query set. You can now add (any) additional parameters.
   *
   * @param query The base query
   */
  constructor(query: string) {
    this._query = query
    this._params = []
  }


  get query(): string {
    return this._query
  }

  get params(): SQParam[] {
    return this._params
  }

  /**
   *
   * Add a new parameter to your query
   *
   * @param parameter Query input parameter
   */
  pushParameter(...parameter: SQParam[]): Query {
    this._params.push(...parameter)

    return this
  }
}

export type SQParam = string | number | boolean;

export function createQuery(query: string, ...params: SQParam[]): Query {
  return new Query(query).pushParameter(...params);
}
