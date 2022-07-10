import fs from "fs";
import valids from "vlds";
import { createHash } from "crypto";
import match from "./match";

declare namespace Database {
    export interface Document<T = any> {
        readonly id: string;
        data: T;
    }

    export interface Collection<T = any> {
        [id: string]: Database.Document<T>;
    }
}

class Database {
    private readonly data: {
        [collectionName: string]: Database.Collection;
    };

    /**
     * Create a database
     * @param path 
     */
    constructor(public readonly path?: string) {
        if (!fs.existsSync(path))
            fs.appendFileSync(path, "{}");

        this.data = path ? JSON.parse(fs.readFileSync(path).toString() ?? "{}") : {};
    }

    /**
     * Sync the data with the file
     */
    private async syncFile() {
        if (this.path)
            await fs.promises.writeFile(this.path, JSON.stringify(this.data));
    }

    /**
     * Create a collection
     * @param name collection name
     * @param validator document validator
     */
    collect<T = any>(name: string, validator: valids.Validator) {
        const type = valids.type(validator);

        const pointer = this;

        if (!pointer.data[name])
            pointer.data[name] = {} as Database.Collection<T>;

        function hash(d: string) {
            return createHash("sha384").update(d).digest("hex");
        }

        const Collection = class {
            readonly value: T;
            readonly id: string;

            /**
             * Create an object and validate it using the validator
             * @param data 
             */
            constructor(data: T) {
                this.value = new type(data);
                this.id = hash(String(Date.now()) + JSON.stringify(pointer.data[name]) + name);
            }

            /**
             * Save or resave the object to the database
             * @returns the object value
             */
            async save() {
                pointer.data[name][this.id] = {
                    id: this.id,
                    data: this.value
                }

                await pointer.syncFile();

                return this.value;
            }

            /**
             * Delete the object from the database
             * @returns true if delete successfully
             */
            async del() {
                const res = delete pointer.data[name][this.id];

                await pointer.syncFile();

                return res;
            }

            /**
             * Set the value
             * @param value 
             */
            async setValue(value: T) {
                // @ts-ignore
                this.value = new type(value);
                await this.save();
            }

            /**
             * Delete an object by its id
             * @param id 
             */
            static async remove(id: string) {
                const res = delete pointer.data[name][id];

                await pointer.syncFile();

                return res;
            }

            /**
             * Delete all objects that match o in the collection
             * @param o 
             * @param count 
             */
            static async removeAll(o: any, count?: number) {
                let res: boolean = true;

                for (const key in pointer.data[name]) {
                    if (typeof count === "number" && count <= 0)
                        break;

                    // Try delete the object if matches
                    if (match(o, pointer.data[name][key]) && !delete pointer.data[name][key]) {
                        res = false;
                        break;
                    }
                }

                await pointer.syncFile();

                return res;
            }

            /**
             * Select the document with the id
             * @param id 
             */
            static select(id: string): Database.Document<T> {
                return pointer.data[name][id];
            }

            /**
             * Find by object match
             * @param o 
             * @param count 
             */
            static find(o: any, count?: number): Database.Document<T>[] {
                const vals = [];

                for (const key in pointer.data[name]) {
                    if (typeof count === "number" && count <= 0)
                        break;

                    const doc = pointer.data[name][key];

                    // Add to value list
                    if (match(o, doc.data)) {
                        vals.push(doc);
                        if (typeof count === "number")
                            count--;
                    }
                }

                return vals;
            }

            /**
             * Find one by object match
             * @param o 
             */
            static findOne(o: any) {
                return this.find(o, 1)[0];
            }

            /**
             * Update the first matched object value with new value
             * @param o 
             * @param value 
             * @param rewrite
             */
            static async update(o: any, value: T, rewrite?: boolean) {
                const doc = this.findOne(o);

                if (!rewrite && typeof pointer.data[name][doc.id].data === "object")
                    Object.assign(pointer.data[name][doc.id].data, value);
                else
                    pointer.data[name][doc.id].data = value;

                // Check type
                pointer.data[name][doc.id].data = new type(pointer.data[name][doc.id].data);

                await pointer.syncFile();
            }

            /**
             * Update the object by a new value by its id
             * @param id 
             * @param rewrite 
             */
            static async updateID(id: string, value: T, rewrite?: boolean) {
                if (!rewrite && typeof pointer.data[name][id].data === "object")
                    Object.assign(pointer.data[name][id].data, value);
                else
                    pointer.data[name][id].data = value;

                // Check type
                pointer.data[name][id].data = new type(pointer.data[name][id].data);

                await pointer.syncFile();
            }
        }

        return Collection;
    }

    /**
     * Remove a collection from the database
     * @param collectionName
     */
    async remove(collectionName: string) {
        delete this.data[collectionName];

        await this.syncFile();
    }

    /**
     * Clear the database
     */
    async clear() {
        // @ts-ignore
        this.data = {};

        await this.syncFile();
    }
}

export = Database;