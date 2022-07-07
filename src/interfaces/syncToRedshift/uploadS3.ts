import { IRecipeType, IRedshiftTables } from '../recipeTypes';

export interface IUploadS3{
  sizeDB: number,
  count: number,
  type: IRecipeType,
  table: IRedshiftTables,
  pathS3: string
}
