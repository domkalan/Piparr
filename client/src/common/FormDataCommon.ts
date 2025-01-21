export abstract class FormDataCommon {
    public static CollectForm(form: HTMLFormElement) {
        const formData : {[key: string]: string | number | Date | boolean;} = {};

        for (let i = 0; i < form.elements.length; i++) {
            const element = form.elements[i] as HTMLInputElement;
    
            // Skip elements without a name or those that don't have a value (e.g., buttons)
            if (element.name && element.value) {
                switch(element.type) {
                    case 'number':
                        formData[element.name] = Number.parseFloat(element.value);

                        break;
                    case 'date':
                        formData[element.name] = Date.parse(element.value);

                        break;
                    case 'checkbox':
                        formData[element.name] = element.value == 'true';

                        break;
                    default:
                        formData[element.name] = element.value;

                        break;
                }

                
            }
        }

        return formData;
    }

    public static ResetForm(form : HTMLFormElement) {
        form.reset();
    }
}