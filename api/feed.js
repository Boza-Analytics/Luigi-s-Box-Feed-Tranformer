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
      // Logika kategorií: nejdelší cesta nebo "Ostatní"
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = "";
      if (categories.length > 0) {
        bestCategory = categories.sort((a, b) => b.length - a.length)[0];
      }
      if (!bestCategory || bestCategory.trim() === "" || bestCategory.trim() === ";") {
        bestCategory = "Ostatní";
      }

      // Logika značky: Vždy DOPS, pokud MANUFACTURER chybí
      let brand = item.MANUFACTURER && item.MANUFACTURER[0] !== "" ? item.MANUFACTURER[0] : "DOPS";

      // Logika obrázků: Optimalizace přes wsrv.nl (funguje lépe než ImageKit bez registrace)
      let originalImg = item.IMGURL ? item.IMGURL[0] : "";
      let optimizedImg = originalImg;
      if (originalImg.startsWith('https://www.dops.cz/')) {
        // encodeURIComponent je klíčový, aby se URL nesekla
        optimizedImg = `https://wsrv.nl/?url=${encodeURIComponent(originalImg)}&w=600&h=600&fit=contain&bg=white`;
      }

      return {
        identity: item.ID[0],
        title: item.PRODUCTNAME ? item.PRODUCTNAME[0] : item.PRODUCT[0],
        web_url: item.URL[0],
        price: `${item.PRICE_VAT[0]} Kč`,
        availability: 1,
        availability_rank: 1,
        availability_rank_text: "Skladem",
        image_link_l: optimizedImg, 
        description: item.DESCRIPTION ? item.DESCRIPTION[0] : "",
        ean: item.EAN ? item.EAN[0] : "",
        brand: brand,
        category: {
          $: { primary: "true" },
          _: bestCategory
        }
      };
    });

    // 3. Sestavení nového XML
    const builder = new xml2js.Builder({
      rootName: 'items',
      cdata: true // Důležité pro zachování HTML v popisech
    });

    const finalXml = builder.buildObject({ item: transformedItems });

    // 4. Odeslání odpovědi
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(finalXml);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transforming feed');
  }
};
