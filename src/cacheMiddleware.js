const NodeCache = require('node-cache');


class Cache {

    constructor() {
        this.cache = new NodeCache({stdTTL: 5 * 60});
    }

    set(query, results) {
        this.cache.set(query, results);
    }

    remove(key) {
        this.cache.del(key);
    }

    get(query, response, next) {
        const content = this.cache.get(query);
        if (content) {
            console.log("CACHED");
            return response.status(200).send(content)
        }
        return next()
    }
}


export default Cache