import { Request, Response } from 'express';
import { sendSuccess } from '../../../common/utils/api-response';
import { productTypeService } from './product-type.service';
import type {
  CreateProductTypeBody,
  UpdateProductTypeBody,
} from './product-type.validator';

export class ProductTypeController {
  list = async (_req: Request, res: Response) => {
    const data = await productTypeService.list();
    return sendSuccess(res, data, 'Master data fetched');
  };

  listActive = async (_req: Request, res: Response) => {
    const data = await productTypeService.listActive();
    return sendSuccess(res, data, 'Active product types fetched');
  };

  getById = async (req: Request, res: Response) => {
    const data = await productTypeService.getById(String(req.params.id ?? ''));
    return sendSuccess(res, data, 'Product Type fetched');
  };

  create = async (req: Request, res: Response) => {
    const data = await productTypeService.create(req.body as CreateProductTypeBody);
    return sendSuccess(res, data, 'Master record created', 201);
  };

  update = async (req: Request, res: Response) => {
    const data = await productTypeService.update(
      String(req.params.id ?? ''),
      req.body as UpdateProductTypeBody,
    );
    return sendSuccess(res, data, 'Master record updated');
  };

  remove = async (req: Request, res: Response) => {
    const data = await productTypeService.delete(String(req.params.id ?? ''));
    return sendSuccess(res, data, 'Master record deleted');
  };
}

export const productTypeController = new ProductTypeController();
