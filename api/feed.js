const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
  try {
    // 1. Stáhnout původní XML
    const response = await axios.get('https://www.dops.cz/editor/filestore/io_folder/luigisbox.xml');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(response.data);
    const shopItems = result.SHOP.SHOPITEM;
    
    // 2. Transformace položek
    const transformedItems = shopItems.map(item => {
      // Logika kategorií
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = categories.length > 0 ? categories.sort((a, b) => b.length - a.length)[0] : "Ostatní";
      if (!bestCategory || bestCategory.trim() === "" || bestCategory.trim() === ";") {
        bestCategory = "Ostatní";
      }
      
      // Vzít maximálně poslední 2 úrovně kategorie
      const categoryParts = bestCategory
        .split('|')
        .map(part => part.trim())
        .filter(part => part !== '');
      
      const finalCategory = categoryParts.length > 2
        ? categoryParts.slice(-2).join(' | ')  // Poslední 2 úrovně
        : categoryParts.join(' | ');            // Všechny, pokud je méně než 2
      
      // Logika značky
      let brand = item.MANUFACTURER && item.MANUFACTURER[0] !== "" ? item.MANUFACTURER[0] : "DOPS";
      
      // Logika obrázků
      let originalImg = item.IMGURL ? item.IMGURL[0] : "";
      let optimizedImg = originalImg;
      if (originalImg.startsWith('https://www.dops.cz/')) {
        optimizedImg = `https://wsrv.nl/?url=${encodeURIComponent(originalImg)}&w=600&h=600&fit=contain&bg=white`;
      }
      
      // Definice podrobného názvu (Title)
      let fullTitle = "";
      if (item.PRODUCT && item.PRODUCT[0]) {
        fullTitle = item.PRODUCT[0];
      } else if (item.PRODUCTNAME && item.PRODUCTNAME[0]) {
        fullTitle = item.PRODUCTNAME[0];
      }
      
      return {
        identity: item.ID[0],
        title: fullTitle, 
        web_url: item.URL[0],
        price: `${item.PRICE_VAT[0]} Kč`,
        availability: 1,
        availability_rank: 1,
        availability_rank_text: "Skladem",
        image_link_l: optimizedImg, 
        description: item.DESCRIPTION ? item.DESCRIPTION[0] : "",
        ean: item.EAN ? item.EAN[0] : "",
        brand: brand,
        category: finalCategory || "Ostatní"
      };
    });
    
    // 3. Extract unique categories for separate category elements
    const uniqueCategories = [...new Set(transformedItems.map(item => item.category))];
    const categoryElements = uniqueCategories.map(cat => ({
      $: { primary: "true" },
      _: cat
    }));
    
    // 4. Sestavení nového XML s items a categories jako siblings
    const builder = new xml2js.Builder({
      rootName: 'items',
      cdata: true,
      headless: false,
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });
    
    // Build structure with both item and category at root level
    const feedStructure = {
      item: transformedItems,
      category: categoryElements
    };
    
    const finalXml = builder.buildObject(feedStructure);
    
    // 5. Odeslání odpovědi
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(finalXml);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transforming feed');
  }
};
