export interface ArrayOptions {
  autoAdd?: boolean;
  compact?: boolean;
  itemCell?: BunsenCell;
  showLabel?: boolean;
  sortable?: boolean;
}

export interface BooleanRenderer {
  name: 'boolean'
}

export interface ButtonGroupRenderer {
  name: 'button-group',
  size?: string;
}

export interface CheckboxArrayRenderer {
  type: 'checkbox-array';
  labels?: {[index:string]:string};
  size?: string;
}

export interface Condition {
  equals?:any;
  notEquals?:any;
  greaterThan?:any;
  lessThan?:any;
  contains?:any;
}

export interface ConditionSet {
  if?: Condition[];
  unless?: Condition[];
  then?: BunsenCell
}

export interface CustomRenderer {
  name: string;
}

export interface LinkRenderer {
  name: 'link';
  route?: string;
  label?: string;
  defaultLabel?: string;
  url?: string;
}

export interface NumberRenderer {
  name: 'number'
}

export interface ObjectTransform {
  object: {[index:string]: string | number | boolean};
}

export interface PasswordRenderer {
  name: 'password'
}

export interface SelectRenderer {
  name: 'select' | 'multi-select'
  options?: {
    data?: {label:string, value:any} []
    endpoint?: string
    localFiltering?: boolean
    labelAttribute?: string
    modelType?: string
    none?: {
      label: string
      present: boolean
      value: any
    }
    query?: {[index:string]:any}
    queryForCurrentValue?: boolean
    recordsPath?: string
    valueAttribute?: string
  }
}

export interface StringRenderer {
  name: 'string'
  type?: string
}

export interface StringTransform {
  from: string
  global?: boolean
  regex?: boolean
  to: string
}

export interface TextAreaRenderer {
  name: 'textarea'
  cols?: number
  rows?: number
}

export type TransformArray = Array<ObjectTransform | StringTransform>

export interface UrlRenderer {
  name: 'url'
}

export type Renderer = BooleanRenderer |
  ButtonGroupRenderer |
  CheckboxArrayRenderer |
  CustomRenderer |
  LinkRenderer |
  NumberRenderer |
  PasswordRenderer |
  SelectRenderer |
  StringRenderer |
  TextAreaRenderer |
  UrlRenderer

export interface BunsenCell {
  arrayOptions?: ArrayOptions
  classNames?: {cell: string, label: string, value: string}
  children?: BunsenCell[]
  clearable?: boolean
  collapsible?: boolean
  conditions?: ConditionSet
  dependsOn?: string
  description?: string
  disabled?: boolean
  extends?: string
  hideLabel?: boolean
  label?: string
  model?: string
  placeholder?: string
  renderer?: Renderer
  transforms?: {
    read?: TransformArray
    write?: TransformArray
  }
}

export interface BunsenView {
  cellDefinitions: {[index:string]:BunsenCell};
  cells: BunsenCell[];
  version: string;
  type: 'detail' | 'form';
}
