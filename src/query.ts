import { encodeParam } from './protocol';
import { SQParam } from './skytable';

export class Query {
  private query: string;
  private params: string[];

  /**
   * Create a new query with the base query set. You can now add (any) additional parameters.
   *
   * @param query The base query
   */
  constructor(query: string) {
    this.query = query;
    this.params = [];
  }
  /**
   * Get the query string
   * @returns query string
   */
  getQuery(): string {
    return this.query;
  }

  /**
   * Get the Params
   * @returns params encoded string
   */
  getParams(): string[] {
    return this.params;
  }
  /**
   * Get the number of parameters
   *
   * @returns Returns a count of the number of parameters
   */
  public getParamCount(): number {
    return this.params.length;
  }

  /**
   * Get the query length
   *
   * @returns Returns the length of the query
   */
  public getQueryLength(): number {
    return this.query.length;
  }
  /**
   *
   * Add a new parameter to your query
   *
   * @param param Query input parameter
   */
  public pushParam(param: SQParam): void {
    this.params.push(encodeParam(param));
  }
}
