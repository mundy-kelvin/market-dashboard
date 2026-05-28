import { Pipe, PipeTransform } from '@angular/core';
import { formatPrice } from '../../core/utils/format.util';

@Pipe({ name: 'currencyFormat', standalone: true })
export class CurrencyFormatPipe implements PipeTransform {
  transform(value: number): string {
    return formatPrice(value);
  }
}
