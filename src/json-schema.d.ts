/**
 * Created by agonzalez on 7/17/14.
 */
export interface JSONSchemaBase {
  $ref?:string;
  $schema?: JSONSchema;
  id?:string;
  title?:string;
  type?:string | string [];
  name?:string;
  description?:string;
  enum?: any[]
  default?:any
  allOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  not?: JSONSchema;
}

export interface StringSchema extends JSONSchemaBase {
  pattern?:string;
  minLength?:number;
  maxLength?:number;
  format?:string;
}

export interface NumberSchema extends JSONSchemaBase {
  pattern?:string;
  multipleOf?:number;
  minimum?:number;
  exclusiveMinimum?:boolean;
  maximum?:number;
  exclusiveMaximum?:boolean;
}

export interface ObjectSchema extends JSONSchemaBase {
  properties?:{[index:string]:JSONSchema};
  minProperties?:number;
  maxProperties?:number;
  patternProperties?:{[index:string]:JSONSchema};
  additionalProperties?:boolean | JSONSchema;
  required?:string[];
  dependencies?: {[key: string]: JSONSchema | string[]};
}

export interface ArraySchema extends JSONSchemaBase {
  items?: JSONSchema[] | JSONSchema;
  uniqueItems?:boolean;
  additionalItems?:boolean;
  minItems?:number;
  maxItems?:number;
}

// export type JSONSchema = JSONSchemaBase | StringSchema | NumberSchema | ObjectSchema | ArraySchema

export interface JSONSchema extends JSONSchemaBase, StringSchema, NumberSchema, ObjectSchema, ArraySchema {}