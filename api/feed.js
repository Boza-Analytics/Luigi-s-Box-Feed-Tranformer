const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
  try {
    const response = await axios.get('https://www.dops.cz/editor/filestore/io_folder/luigisbox.xml');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(response.data);

    const shopItems = result.SHOP.SHOPITEM;
    
    // Nastavení pro ImageKit (můžete si vytvořit vlastní účet pro plnou kontrolu, 
    // nebo zkusit tuto proxy metodu pro demo)
    const IMAGEKIT_URL = "https://ik.imagekit.io/demo/tr:w-600,h-600,cm-pad_resize,bg-FFFFFF/";

    const transformedItems = shopItems.map(item => {
      // 1. Logika kategorií
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = "";
      if (categories.length > 0) {
        bestCategory = categories.sort((a, b) => b.length - a.length)[0];
      }
      if (!bestCategory || bestCategory.trim() === "" || bestCategory.trim() === ";") {
        bestCategory = "Ostatní";
      }

      // 2. Logika značky (vždy DOPS)
      let brand = item.MANUFACTURER && item.MANUFACTURER[0] !== "" ? item.MANUFACTURER[0] : "DOPS";

      // 3. Logika obrázků (SMUSH / RESIZE)
      let originalImg = item.IMGURL ? item.IMGURL[0] : "";
      let optimizedImg = originalImg;
      
      if (originalImg.includes('https://www.dops.cz/')) {
        // Změníme URL na optimalizovanou verzi přes ImageKit
        optimizedImg = IMAGEKIT_URL + originalImg;
      }

      return {
        identity: item.ID[0],
        title: item.PRODUCTNAME ? item.PRODUCTNAME[0] : item.PRODUCT[0],
        web_url: item.URL[0],
        price: `${item.PRICE_VAT[0]} Kč`,
        availability: 1,
        availability_rank: 1,
        availability_rank_text: "Skladem",
        image_link_l: optimizedImg, // Teď už zmenšený a lehký obrázek
        description: item.DESCRIPTION ? item.DESCRIPTION[0] : "",
        ean: item.EAN ? item.EAN[0] : "",
        brand: brand,
        category: {
          $: { primary: "true" },
          _: bestCategory
        }
      };
    });

    const builder = new xml2js.Builder({
      rootName: 'items',
      cdata: true
    });

    const finalXml = builder.buildObject({ item: transformedItems });

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(finalXml);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transforming feed');
  }
};
