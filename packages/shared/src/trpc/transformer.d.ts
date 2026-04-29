declare function decode(value: unknown): unknown;
export declare const dermaosTransformer: {
    input: {
        serialize: (value: unknown) => {
            json: unknown;
        };
        deserialize: typeof decode;
    };
    output: {
        serialize: (value: unknown) => {
            json: unknown;
        };
        deserialize: typeof decode;
    };
};
export {};
//# sourceMappingURL=transformer.d.ts.map