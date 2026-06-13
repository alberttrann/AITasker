declare const _default: () => {
    port: number;
    corsOrigin: string;
    database: {
        url: string;
        directUrl: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    sepay: {
        secretKey: string;
        apiBase: string;
    };
    fastapi: {
        url: string;
    };
    platform: {
        settingsId: string;
        feePct: number;
    };
};
export default _default;
