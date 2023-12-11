export class Query {
    private query_buffer: Uint8Array;
    private param_buffer: Uint8Array;
    private param_cnt: number;

    /**
     * Create a new query with the base query set. You can now add (any) additional parameters.
     * 
     * @param query The base query
     */
    constructor(query: string) {
        this.query_buffer = new Uint8Array(Buffer.from(query, 'utf-8'));
        this.param_buffer = new Uint8Array();
        this.param_cnt = 0;
    }
    /**
     * Get the number of parameters
     * 
     * @returns Returns a count of the number of parameters
     */
    getParamCount(): number {
        return this.param_cnt;
    }
    /**
     * 
     * Add a new parameter to your query
     * 
     * @param parameter Query input parameter
     */
    pushParameter(parameter: SQParam): void {
        this.param_cnt += parameter.encode(this.param_buffer);
    }
}

/**
 * The simple query parameter interface.
 * 
 * Any type implementing this interface can be passed as a parameter into the `Query` object
 */
export interface SQParam {
    encode(vecBuffer: Uint8Array): number;
}
