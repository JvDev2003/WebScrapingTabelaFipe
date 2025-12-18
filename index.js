const { PlaywrightCrawler, BasicCrawler, RequestQueue } = require("crawlee")
const fs = require("fs")
const path = require("path")

const OUTPUT_FILE = path.join(__dirname, "carros.json")
const stream = fs.createWriteStream(OUTPUT_FILE, { flags: "a" })

;(async () => {

    try {
        const crawler = new PlaywrightCrawler({
        maxConcurrency: 50,
        async requestHandler({ page, enqueueLinks, request }) {

            if (!request.label) {
            const links = await page
                .locator("tr.link")
                .evaluateAll(rows =>
                    rows.map(r => r.getAttribute("data-url")).filter(Boolean)
                )

                await enqueueLinks({ urls: links, label: "DETALHE" })
                return
            }

            if (request.label === "DETALHE") {
                const linksCarro = await page
                    .locator("tr.link")
                    .evaluateAll(rows =>
                        rows.map(r => r.getAttribute("data-url")).filter(Boolean)
                    )

                await enqueueLinks({ urls: linksCarro, label: "CARRO" })
                return
            }

            if (request.label === "CARRO") {
                const detalhes = await page.locator('table.info').innerText()
                const linhas = detalhes.split("\n").map(l => l.trim())
                const carroNormalizado = {}
                linhas.forEach(linha =>{
                    let chaveBruta = ""
                    let valorBruto = ""

                    if (linha.includes(":")) {
                        ;[chaveBruta, valorBruto] = linha.split(":")
                    } else {
                        ;[chaveBruta, valorBruto] = linha.split(/\s{2,}|\t/)
                    }
                    const chave = chaveBruta.toLowerCase()
                                            .normalize("NFD")
                                            .replace(/[\u0300-\u036f]/g, "")
                                            .replace(/[^a-z0-9 ]/g, "")
                                            .trim()
                                            .replace(/\s+/g, "_")
                    
                    const valor = valorBruto.replace(`(alterar)`, ``)
                                            .trim()

                    carroNormalizado[chave] = valor           
                    return 
                })
                stream.write(JSON.stringify(carroNormalizado) + "\n")
            }
        }
        })

        const urls = []
       const queue = await RequestQueue.open()

        // request inicial
        await queue.addRequest({
        url: "https://brasilapi.com.br/api/fipe/marcas/v1",
        label: "MARCAS"
        })

        const apiCrawler = new BasicCrawler({
        requestQueue: queue,
        maxConcurrency: 1,

        async requestHandler({ request }) {
            const res = await fetch(request.url)
            const data = Array.from(await res.json())

            // ===== MARCAS =====
            if (request.label === "MARCAS") {
            for (const marca of data) {
                await queue.addRequest({
                url: `https://brasilapi.com.br/api/fipe/veiculos/v1/carros/${marca.valor}`,
                label: "MODELOS",
                userData: { marca }
                })
            }
            return
            }

            // ===== MODELOS =====
            if (request.label === "MODELOS") {
            const { marca } = request.userData

            for (const modelo of data) {
                const nomeModelo = modelo.modelo.split(" ")[0]

                urls.push(
                `https://tabelacarros.com/anos_modelos/carros/${marca.nome}/${nomeModelo}`
                )
            }
            }
        }
        })


        await apiCrawler.run()
        await crawler.run(urls)
        
        process.on("exit", () => {
            stream.end()
        })
        
    } catch (err) {
        console.error(
        "❌ Erro:",
        err.response?.status,
        err.response?.data || err.message
        )
    }
})()

    // const { data: marcas } = await axios.get(linkMarcas)

    // const urls = []
    // for (const marca of marcas) {
    //     await sleep(800)
    // const { data: modelos } = await axiosComRetry(
    //     `https://brasilapi.com.br/api/fipe/veiculos/v1/carros/${marca.valor}`
    // )

    // modelos.forEach(async (modelo) => {
    //     await sleep(800)
    //     const nomeModelo = modelo.modelo.split(" ")[0]
    //     urls.push(
    //     `https://tabelacarros.com/anos_modelos/carros/${marca.nome}/${nomeModelo}`
    //     )
    // })
    // }